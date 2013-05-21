// This module implements all of the REST API.

var config = require('../config')

var request = require('request');
var async = require('async');
var moment = require('moment');

var JiraApi = require('jira').JiraApi;
var MongoClient = require('mongodb').MongoClient;

var db;
var issues;
var lists;
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

        db.collection('lists', function(err, _lists) {
            if (err) {
                console.log("Could not open lists collection: " + err);
                return;
            }
            lists = _lists;
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
        maxResults: 500, 
        fields: ["*all"]            
    }
    jira.searchJira(query, options, function(error, jd) {

        if (error) {
            console.log("Jira error " + error + jd);
            callback(error, null);
        } else {

            var saveTasks = jd.issues.map(function(issue) {
                return function(callback) {
                    issue._id = issue.id;
                    fixDates(issue.fields);
                    issue.fields.comment.comments.forEach(fixDates);
                    issue.fields.worklog.worklogs.forEach(fixDates);
                    issues.update({_id: issue.id}, issue, {safe: true, upsert: true}, callback);
                    console.log("Updated " + issue.key);
                }
            });
            async.series(saveTasks, callback);
        }
    });
}

function queryAndSaveList(listId, query, callback)
{
    console.log("queryAndSaveUpdated");

    maxResults = 500;
    var options = {
        maxResults: 500, 
        fields: ["id", "key", "updated", "summary", "priority", "assignee", "customfield_11741"],
    }
    console.log("List query " + query);
    jira.searchJira(query, options, function(error, jd) {

        if (error) {
            callback(error, null);
        } else {
           
            if (jd.total > maxResults) {
                console.log("Too many changed issues");
                callback("Too many changed issues", null);
                return;
            }

            jd._id = listId;
            lists.update({_id: listId}, jd, {safe: true, upsert: true}, callback);
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

exports.update = function(req, res) {
    var now = new Date();
    var since = "-10d";
    if (meta.lastIssuesSync)
    {
        var jiraDate = new Date(meta.lastIssuesSync);
        var selfToJiraMillis = (jiraDate.getTimezoneOffset() - config.jira.timezone) * 60 * 1000;
        jiraDate.setTime(jiraDate.getTime() + selfToJiraMillis);
        var jiraDateString = moment(jiraDate).format("YYYY-MM-DD HH:mm");
        console.log("Sync of issues since " + jiraDate + " in timezone of '" + config.jira.user + "'");
        since = '"' + jiraDateString + '"';
    }
    
    function updateAllChanged(callback) {
        var query = "project in (" + config.jira.projects.join(',') + ") and updated>" + since;
        queryAndSaveIssues(query, callback);
    }

    function updateListFactory(list) {
        return function(callback) {
            queryAndSaveList(list.id, list.query, callback);            
        }
    }

    var tasks = [updateAllChanged].concat(config.lists.map(updateListFactory))

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
               
            result.push({key: issue.key, summary: issue.fields.summary, log: log});
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
                res.send(document.issues);
            }
        }
    });    
}

