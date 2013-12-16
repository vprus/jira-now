// This module implements all of the REST API.

var config = require('../config')

var request = require('request');
var async = require('async');
var moment = require('moment');
var url = require('url');
var util = require('util');

var JiraApi = require('jira').JiraApi;
var MongoClient = require('mongodb').MongoClient;

var db;
var issues;
var lists;
var structures;
var sprints;

var metaCollection;
var meta;

var jira = new JiraApi("http", config.jira.host, config.jira.port || 80, config.jira.user, config.jira.password, 2, true);


MongoClient.connect(config.mongo.url, function(err, d) {
    if(err) {
        console.log("Could not connect to database:" + err);
    } else {
        console.log("Connected to database");
        db = d;

        db.collection('issues', function(err, _issues) {
            if (err) {
                console.log("Could not open issues collection: " + err);
                return;
            }
            issues = _issues;
        });

        db.ensureIndex('issues', 'fields.worklog.worklogs.created', function(err, indexName) {
            console.log("Index creation" + err + ": " + indexName);
        });

        db.collection('structures', function(err, _structures) {
            if (err) {
                console.log("Could not open structures collection: " + err);
                return;
            }
            structures = _structures;
        });

        db.collection('lists', function(err, _lists) {
            if (err) {
                console.log("Could not open lists collection: " + err);
                return;
            }
            lists = _lists;
        });

        db.collection('sprints', function(err, _sprints) {
            if (err) {
                console.log("Could not open sprints collection: " + err);
                return;
            }
            sprints = _sprints;
        });

        db.collection('meta', function(err, _meta) {
            if (err) {
                console.log("Could not open meta collection: " + err);
                return;
            }
            
            metaCollection = _meta;
            metaCollection.findOne(function (err, document) {
                if (!document) {
                    metaCollection.insert({lastJiraSync: null}, function(err, document) {
                        if (err) {
                            console.log("Could not insert meta record");
                        } else {
                            meta = document;
                        }
                    });
                } else {
                    meta = document;
                }
            });
        });

    }
})

function fixDates(item)
{
    item.created = new Date(item.created);
    if (item.updated)
        item.updated = new Date(item.updated);
    if (item.started)
        item.started = new Date(item.started);
}

// Get full content of the issues returned by 'query',
// and store them in 'issues' collection in the database.
// At present, due to https://jira.atlassian.com/browse/JRA-30854
// search cannot return full information on issues, so eventually
// this method will be modified to accept a list of issue keys 
// and access them individually.
function queryAndSaveIssues(query, callback) 
{
    var options = {
        // FIXME: should use chunking to fetch all issues.
        maxResults: 1500, 
        fields: ["id, key"]            
    }
    jira.searchJira(query, options, function(error, jd) {

        if (error) {
            console.log("Jira error " + error + jd);
            callback(error, null);
        } else {
            
            var queryTasks = jd.issues.map(function(minIssue) {
                
                return function(callback) {
                    jira.findIssue(minIssue.id + "?expand=changelog", function(error, issue) {
                        if (error) {
                            console.log("Error getting details on " + minIssue.key);
                            callback(error, null);
                        } else {
                            if (issue.key == "CB-2404") {
                                console.log("!!!!! " + JSON.stringify(issue, null, 4));
                            }
                            issue._id = issue.id;
                            fixDates(issue.fields);
                            issue.fields.comment.comments.forEach(fixDates);
                            issue.fields.worklog.worklogs.forEach(fixDates);
                            issue.changelog.histories.forEach(fixDates);
                            issues.update({_id: issue.id}, issue, {safe: true, upsert: true}, callback);
                            console.log("Updated " + issue.key);
                        }
                    });
                }
            });
            async.parallelLimit(queryTasks, 20, callback);

/*
            var saveTasks = jd.issues.map(function(issue) {




                return function(callback) {
                    
                }
            });
            async.series(saveTasks, callback);
*/
        }
    });
}

// Query Jira, obtaining minimal set of fields. Presently, this is used to
// display issue list with limited details. In future, we might want to just
// obtain ids, move the whiteboard fixup code into above queryAndSaveIssue,
// and then join issue id lists with actual data when necessary.
function queryMinimal(query, callback)
{
    maxResults = 500;
    var options = {
        maxResults: 500, 
        fields: ["id", "key", "updated", "summary", "priority", "assignee", "fixVersions", config.jira.whiteboardFieldId],
    }
    jira.searchJira(query, options, function(error, jd) {

        if (error) {
            callback(error, null);
        } else {
           
            if (jd.total > maxResults) {
                console.log("Too many changed issues");
                callback("Too many changed issues", null);
                return;
            }

            // Add artificial field _whiteboard to isolate client side
            // code from actual id of whiteboard field.
            jd.issues.forEach(function (issue) {
                issue.fields._whiteboard = issue.fields[config.jira.whiteboardFieldId];
            });

            callback(null, jd);
        }
    });
}

function updateList(list, callback)
{
    if (list.explicitGrouping) {

        console.log("Updating explicit list");

        var tasks = list.groups.map(function(g) {
            return function(callback) {

                lists.findOne({_id: g.filterId}, function(error, document) {
                    if (error) {
                        callback(error, null);
                    } else if (document == null) {
                        callback("Could not obtain filter '" + g.filterId + "'");
                    } else {
                        callback(null, {name: g.name, description: g.description, help: g.help, issues: document.issues});
                    }
                });
            }
        });

        async.series(tasks, function(error, results) {
            if (error) {
                callback(error, null);
            } else {

                console.log("Saved list");
                var seen = {};
    
                results = results.map(function(group) {
                    var r = [];
                    group.issues.forEach(function(issue) {
                        if (!(issue.key in seen)) {
                            r.push(issue);
                        }
                        seen[issue.key] = 1;
                    });
                    group.issues = r;
                    return group;
                });

                result = {_id: list.id, issues: [], groups: results};

                //console.log("Groups: " + JSON.stringify(results, null, 4));
                lists.update({_id: list.id}, result, {safe: true, upsert: true}, callback);
                return;
            }
        });
        return;
    }

    queryMinimal(list.query, function (error, jd) {

        if (list.groups) {
            var groupMap = {}
            list.groups.forEach(function(x) { groupMap[x] = []; });
            jd.issues.forEach(function(issue) {
                var group;
                for (var i = 0; i < issue.fields.fixVersions.length; ++i) {
                    var v = issue.fields.fixVersions[i].name;
                    if (v in list.groupByVersion) {
                        group = list.groupByVersion[v];
                        break;
                    }
                }
                if (!group) { group = list.defaultGroup; }
                groupMap[group].push(issue);
            });
            jd.groups = list.groups.map(function(x) { 
                return {name: x, issues: groupMap[x]};
            });
        } else {
            jd.groups = [{name: "", issues: jd.issues}];
        }
        
        jd._id = list.id
        lists.update({_id: list.id}, jd, {safe: true, upsert: true}, callback);        
    });
}

function updateFilter(filter, callback)
{
    if (filter.type == "structure-children") {

        queryMinimal(filter.query, function(error, data) {
            if (error) {
                console.log("Query '" + filter.query + "' resulted in: " + JSON.stringify(error, null, 4));
                callback(error, null);
                return;
            }
           
            structures.findOne({_id: filter.structure}, function(error, s) {
                if (error) {
                    callback(error, null);
                    return;
                }

                var result = [];
                var childless = [];
                data.issues.forEach(function (issue) {                    

                    console.log("Issue " + issue.key + "/" + issue.id + " has these children: " + s._tree[issue.id]);

                    var children = s._tree[issue.id];
                    if (s._tree[issue.id] != undefined) {
                        s._tree[issue.id].forEach(function(x) { result.push(x); });
                    } else {
                        // For now, put issue without children in result as well.
                        childless.push(issue.id);
                    }
                });

                if (result.length)
                {
                    var query = "id in (" + result.join(",") + ")";
                    if (filter.subquery) {
                        query = query + " and " + filter.subquery;
                    }
                    if (childless.length) {
                        query = "(" + query + ") or (id in (" + childless.join(",") + "))";
                    }

                    queryMinimal(query, function(error, data) {

                        if (error) {
                            console.log("Query: " + query);
                            console.log(JSON.stringify(error, null, 4));
                            return;
                        }

                    
                        data._id = filter.id;         
                        // console.log("Final filter result " + JSON.stringify(data, null, 4));
                        lists.update({_id: filter.id}, data, {safe: true, upsert: true}, callback);                    
                    });                
                }
                else
                {
                    // No matching issue
                    data = {_id: filter.id, issues: []};
                    lists.update({_id: filter.id}, data, {safe: true, upsert: true}, callback);                    
                }
            });
        });

    } else if (filter.type == 'query') {

        queryMinimal(filter.query, function(error, data) {

            if (error) {
                console.log("Query error: " + JSON.stringify(error, null, 4));
                return;
            }

            data._id = filter.id;         
            lists.update({_id: filter.id}, data, {safe: true, upsert: true}, callback);
        });
        
    } else {
        callback("Invalid filter type", null);
    }
}

function updateStructure(id, callback)
{
    console.log("Updating structure " + id);

    maxResults = 500;
    var options = {
        maxResults: 500, 
        fields: ["id", "key", "updated", "summary", "priority", "assignee", "fixVersions", config.jira.whiteboardFieldId],
    }

    function makeStructureUri(pathname) {

        var uri = url.format({
            protocol: jira.protocol,
            hostname: jira.host,
            auth: jira.username + ':' + jira.password,
            port: jira.port,
            pathname: 'rest/structure/1.0/' + pathname
        });
        return uri;
    };

    function getStructure(id, callback) {

        var options = {
            uri: makeStructureUri('structure/' + id + '/forest'),
            method: 'GET',
            json: true
        };

        // Uhm, Jira library should provide a way to request random URL.
        jira.request(options, function(error, response, body) {

            if (error) {
                callback(error, null);
                return;
            }

            if (response.statusCode === 200) {           
                callback(null, body);
                return;
            }
            if (response.statusCode === 500) {
                callback(response.statusCode + ': Error while retrieving structure ' + id + '.');
                return;
            }

            callback(response.statusCode + ': Error while updating');
        });
    }

    // Take Structure's 'formula', which is a list of 'id:depth' pairs and create a tree we can use, mapping
    // from issue id to all children.
    function makeTree(formula) {

        formula = formula.split(',').map(function(f) { var s = f.split(':'); return [parseInt(s[0]), parseInt(s[1])]; });
        console.log("Formula = " + formula);

        var tree = {};
        var levels = [];

        formula.forEach(function(f) {
            
            var id = f[0];
            var level = f[1];

            tree[id] = [];

            if (level > 0) {
                var parent = levels[level-1];
                
                tree[parent].push(id);
            }
            levels[level] = id;
        });

        return tree;
    }

    getStructure(id, function(error, jd) {

        if (error) {
            console.log("Ick " + error);
            callback(error, null);
        } else {

            jd._id = jd.structure;
            jd._tree = makeTree(jd.formula);
            structures.update({_id: jd.structure}, jd, {safe: true, upsert: true}, callback);
        }
    });
}


function updateSprint(sprint, callback)
{
    console.log("Updating sprint " + sprint.id);

    var now = new Date();

    var dateMatch = {$gt: sprint.start, $lt: sprint.end};
    var elemMatch = {$elemMatch: {'started': dateMatch}};
    var whiteboard = 'fields.' + config.jira.whiteboardFieldId;
    var projection = {'key': 1, 'fields.summary': 1, 'fields.status': 1, 'fields.worklog': 1, 'changelog': 1};
    projection[whiteboard] = 1;
    
    function selectByFields(callback) {

        if (!sprint.fixVersion) {
            callback(null, []);
            return;
        }

        var s = dateToJira(sprint.start);
        var e = dateToJira(sprint.end);
        var query = util.format("project = '%s' and (fixVersion was '%s' DURING('%s', '%s') or resolution changed to fixed DURING('%s', '%s'))",
                                sprint.project, sprint.fixVersion, s, e, s, e);

        console.log("QUERY IS " + query);
        
        queryMinimal(query, function(error, data) {
            if (error) {
                callback(error, null);
            } else {
                var ids = data.issues.map(function(issue) { return issue.id; });
                var selected = issues.find({'id': {'$in': ids}}, projection);
                console.log("Got ids: " + ids);
                selected.toArray(function(err, array) {
                    if (err) {
                        callback(err, null);
                    } else {
                        callback(null, array);
                    }
                });
            }
        });
    }

    function selectByWorklog(callback) {
        var worked = issues.find({'fields.project.key': sprint.project, 'fields.worklog.worklogs': elemMatch}, projection);
        worked.toArray(callback);
    }

    async.parallel([selectByFields, selectByWorklog], function(err, arrays) {

        if (err) {
            console.log("error " + err);
            res.send(err);
        }
        else {

            var array = arrays[0].concat(arrays[1]);
            var seen = {};
            //array.forEach(function(a) { seen[a] = 1; });
            // Dedup. We don't care about order much. It might be
            // more efficient to adjust mongodb query with ids from
            // field selection, as opposed to doing dedup after we get
            // all the data back.
            array = array.sort().filter(function (e, i, a) {
                var seenThis = e.key in seen;                
                seen[e.key] = 1;
                console.log(e.key + " - " + seenThis);
                return !seenThis;
            });
            var workedIssues = [];

            //console.log("Got issues " + JSON.stringify(array, null, 4));
            console.log(array.length + " issues in sprint report");

            array.forEach(function(issue) {
                var back = walkBack(issue, sprint.end);

                console.log(issue.key + " (" + issue.fields.summary + ") :");
                console.log("   "  + back.status + " // " + back.whiteboard);
                workedIssues.push({
                    key: issue.key, 
                    summary: issue.fields.summary,
                    status: back.status,
                    whiteboard: back.whiteboard,
                    timeSpent: workLogged(issue, sprint.start, sprint.end)
                });
            });

            workedIssues.sort(function(a, b) { return b.timeSpent - a.timeSpent; });

            var result = {_id: sprint.id, id: sprint.id, name: sprint.name, start: sprint.start, end: sprint.end, workedIssues: workedIssues};
            sprints.update({_id: sprint.id}, result, {safe: true, upsert: true}, callback);
        }        
    });
}


exports.check = function(req, res, next) {
    if (!jira || !db || !issues) {
        res.send(500, {error: "Server configuration error"});
    } else {
        next();
    }
}

function dateToJira(date) {
    var selfToJiraMillis = (date.getTimezoneOffset() - config.jira.timezone) * 60 * 1000;
    var jiraDate = new Date(date);
    jiraDate.setTime(jiraDate.getTime() + selfToJiraMillis);
    return moment(jiraDate).format("YYYY-MM-DD HH:mm");
}

exports.update = function(req, res) {
    var now = new Date();
    var since = "-10d";
    if (meta.lastIssuesSync)
    {
        var jiraDateString = dateToJira(meta.lastIssuesSync)
        console.log("Sync of issues since " + jiraDateString + " in timezone of '" + config.jira.user + "'");
        since = '"' + jiraDateString + '"';
    }
    
    function updateAllChanged(callback) {
        var query = "project in (" + config.jira.projects.join(',') + ") and updated>" + since;
        queryAndSaveIssues(query, callback);
    }

    function updateStructureFactory(structure_id) {
        return function(callback) {
            updateStructure(structure_id, callback);
        }
    }

    function updateFilterFactory(filter) {
        return function(callback) {
            updateFilter(filter, callback);
        }
    }

    function updateListFactory(list) {
        return function(callback) {
            updateList(list, callback);            
        }
    }

    function updateSprintFactory(sprint) {
        return function(callback) {
            updateSprint(sprint, callback);
        }
    }

    var tasks = [updateAllChanged]
        .concat(config.jira.structures.map(updateStructureFactory))
        .concat(config.filters.map(updateFilterFactory))
        .concat(config.lists.map(updateListFactory))
        .concat(config.sprints.map(updateSprintFactory))
    ;

    async.series(
        tasks,
        function(error, results) {
            if (error) {
                res.send(500, error);
            } else {
                meta.lastIssuesSync = now;
                metaCollection.save(meta, function(err, document) {
                    if (err) {
                        res.send(500, err);
                    } else {                    
                        res.json(meta);
                    }
                });
            }
        }
    );
}

exports.status = function(req, res) {
    res.json(meta);
}

exports.clientConfig = function(req, res) {
    console.log("clientConfig, cookie is ", req.cookies['clientConfig']);
    var clientConfig = req.cookies['clientConfig'];
    if (!clientConfig || !(clientConfig in config.clientConfigs)) {
        clientConfig = "default";
    }
    res.json(config.clientConfigs[clientConfig]);
}

function processChanges(changes, since, users)
{
    if (users.length)
        changes = changes.filter(function(c) { return users.indexOf(c.updateAuthor.name) != -1; });
    changes = changes.filter(function(c) { 
        var d;
        if (c.started)
            d = c.started;
        else
            d = c.created;
        return d.getTime() > since.getTime(); 
    });
    return changes.map(function(c) { 
        var result = {
            author: c.updateAuthor.name,
        }; 
        if (c.timeSpentSeconds) {
            // This is worklog entry
            if (c.comment)
                result.comment = c.comment;
            else
                result.comment = "(no comment)";
            result.timeSpentSeconds = c.timeSpentSeconds;            
            result.date = c.started;
        } else {
            // This is a comment
            result.comment = c.body;
            result.date = c.created;
        }
        return result;
    });
}

exports.changes = function(req, res) {

    if (!req.query.since) {
        res.send(400, {error: "The 'since' query parameter is required"});
        return;
    }
    var users = req.query.user;
    var since = new Date(req.query.since);

    if (users) {
        users = users.split(',')
    } else {
        users = [];
    }
    
    var createdMatch = {'fields.created': {$gt: since},
                        'fields.reporter.name': {$in: users}};

    var elemMatch = {$elemMatch: {'created': {$gt: since}}};
    if (users) {
        elemMatch.$elemMatch['updateAuthor.name'] = {$in: users};
    }

    var comments = issues.find({
        $or: [createdMatch, {'fields.comment.comments': elemMatch}, {'fields.worklog.worklogs': elemMatch}]
    });

    comments.explain(function(err, explanation) {
        console.log(JSON.stringify(explanation));
    });

    var result = [];
    comments.each(function(err, issue) {
        if (issue == null) {
            res.json(result);
        } else {
            var log = []
            
            if (issue.fields.created.getTime() > since.getTime()) {
                log.push({author: issue.fields.reporter.name, date: issue.fields.created, comment: '(Created)'});
            }

            if (issue.fields.comment.comments) {
                log = log.concat(processChanges(issue.fields.comment.comments, since, users));
            }
            if (issue.fields.worklog.worklogs) {
                log = log.concat(processChanges(issue.fields.worklog.worklogs, since, users));
            }
            log.sort(function(a, b) { return a.date.getTime() - b.date.getTime(); });

            // Total seconds by each user
            var totals = {}
            log.forEach(function(entry) {
                if (!(entry.author in totals)) totals[entry.author] = 0;
                totals[entry.author] += (entry.timeSpentSeconds || 0);
            });

            var total = log.reduce(function(a, b) { return a + (b.timeSpentSeconds || 0); }, 0)
               
            result.push({key: issue.key, summary: issue.fields.summary, totals: totals, log: log});
        }
    });
}

exports.list = function(req, res) {

    if (!req.query.id) {
        res.send(400, {error: "The 'id' query parameter is required"});
        return;
    }
    var id = req.query.id;

    lists.findOne({_id: id}, function(error, document) {
        if (error) {
            res.send(500, error);
        } else {

            if (document == null) {
                res.send(500, "The list does not exist");
            } else {
                res.send(document);
            }
        }
    });    
}

function walkBack(issue, date)
{
    var debug = 0;
    if (issue.key == "CB-1995") {
        debug = 1;
    }

    var result = {status: issue.fields.status.name, 
                  whiteboard: issue.fields[config.jira.whiteboardFieldId]};

    if (date.getTime() > (new Date()).getTime()) {
        // Requested date is in future - return the current state.
        return result;
    }

    var wip = {};

    if (issue.changelog) {
        var i = issue.changelog.histories.length-1;
        for(; i >= 0; --i) {
            var h = issue.changelog.histories[i];
            if (h.created.getTime() < date.getTime())
                break;
            h.items.forEach(function(item) {
                if (issue.key == "CB-1995") {
                    console.log("Processing history item " + JSON.stringify(item, null, 4));
                }
                if (item.field == "status") {
                } else if (item.field == "Whiteboard") {
                    // I totally hate Jira. Why is that changelog refers to a field by
                    // human name, with no way to obtain ID in a reliable way?
                    if (item.fromString)
                        wip['whiteboard'] = item.fromString;
                    else
                        wip['whiteboard'] = "not set";
                }
            });
        }
    }// else {
    //    wip = {status: 'unknown', whiteboard: 'unknown'};
    //}

    if (wip.status) {
        result.status = wip.status; // + " (now " + result.status + ")";
    }// else {
    //    result.status = result.status + " (unchanged since)";
    //}

    if (wip.whiteboard) {
        result.whiteboard = wip.whiteboard; /// + " (now " + result.whiteboard + ")";
    } else {
        //result.whiteboard = result.whiteboard + " (unchaged since)";
    }    

    return result;
}

function workLogged(issue, since, until)
{
    var result = 0;

    var sinceT = since.getTime();
    var untilT = until.getTime();

    issue.fields.worklog.worklogs.forEach(function(w) {
        if (sinceT < w.started.getTime() && w.started.getTime() < untilT) {
            result += w.timeSpentSeconds;
        }
    });

    return result;
}

// Returns all the issues that were worked on during specified
// timeframe, including the status/whiteboard they had at the
// end of that period.
exports.sprint = function(req, res) {

    if (!req.query.id) {
        res.send(400, {error: "The 'id' query parameter is required"});
        return;
    }
    var id = req.query.id;

    sprints.findOne({_id: id}, function(error, document) {
        if (error) {
            res.send(500, error);
        } else {

            if (document == null) {
                res.send(500, "The sprint does not exist");
            } else {
                res.send(document);
            }
        }
    });    
}

