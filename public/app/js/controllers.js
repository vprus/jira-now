'use strict';

/* Controllers */

function AppController($scope, $http, $timeout, $cookies, sprintSchedule) {

    $scope.loaded = 0;

    $scope.updating = 0;

    $scope.meta = {lastIssueSync: null};
   
    $http({method: 'GET', url: '/api/status'})
        .success(function(data, status, headers, config) {
            $scope.meta = data;
        });
    $http({method: 'GET', url: '/api/session'})
        .success(function(data, status, headers, config) {
            $scope.session = data;
        });
    $http({method: 'GET', url: '/api/clientConfig'})
        .success(function(data, status, headers, config) {
            $scope.clientConfig = data;
            console.log("CLIENT CONFIG " + JSON.stringify(data, null, 4));
            $scope.loaded = 1;
        });

    $scope.updateIssues = function($q) {
        $scope.updating = 1;

        $http({method: 'POST', url: '/api/update'})
            .success(function(data, status, headers, config) {
                $scope.meta = data;
                $scope.updating = 0;
            })
            .error(function(data, status, headers, config) {
                $scope.error = "Could not update: " + data;
                $scope.updating = 0;
            });                
    }

    $scope.updatedLabel = function()
    {
        if ($scope.updating) 
            return "Updating...";

        var time = $scope.meta.lastIssuesSync;

        if (!time)
            return "Never updated";

        return "Updated " + moment(time).fromNow();
    }

    function updateTimes()
    {
        $scope.monday = sprintSchedule.getMonday();
        $scope.teamCall = sprintSchedule.getTeamCall();
        $scope.previousMonday = sprintSchedule.getPreviousMonday();
        $scope.previousTeamCall = sprintSchedule.getPreviousTeamCall();        
    }

    updateTimes();
}


function PersonalController($scope, $routeParams, Worklog) {

    var week = $routeParams.week;
    var user = $scope.session.username;
    var start = moment(week);
    var monday = moment(week).startOf('isoWeek');

    if (!start.isSame(monday)) {
        // FIXME: improve wording.
        $scope.error = "Not a monday";
    }
       
    start.hour(5);
    var end = moment(start);
    end.add('days', 7);
    $scope.start = start;

    $scope.dates = []
    for (var i = 0; i < 7; ++i)
    {
        var thisDay = moment(start);
        thisDay.add('days', i);
        $scope.dates.push(thisDay.date());
    }

    $scope.user = user;
    $scope.fullName = $scope.session.fullName
    $scope.week = $routeParams.week;
    $scope.previousWeek = moment(monday).subtract('days', 7).format('YYYY-MM-DD');
    $scope.nextWeek = moment(monday).add('days', 7).format('YYYY-MM-DD');

    $scope.workedIssues = 0;
    $scope.workedSeconds = 0;

    $scope.perIssuePerDay = {}
    $scope.dayTotal = {0: 0, 1: 0, 2:0, 3: 0, 4: 0, 5: 0, 6: 0};

    var params = {
        since: start.toISOString(), 
        until: end.toISOString(),
        users: user
    };

    $scope.reportLogFilter = function(log) {
	if (log.comment == '(Created)')
	    return 0;

	return 1;
    }

    $scope.reportIssueFilter = function(issue) {
	//return issue.includeInReport;
	return 1;
    }

    $scope.issueWorkedSeconds = function(issue) {
	return issue.seconds;
    }

    $scope.issues = [];
    var seconds = 0;
    var issuesPromise = Worklog.query(params, function() {
            
	$scope.issues = issuesPromise;
        $scope.workedIssues = $scope.issues.length;
	$scope.issues.forEach(function (issue) {
	    issue.includeInReport = 0;
	    issue.seconds = 0;
	    issue.log.forEach(function (item) {
                if (item.timeSpentSeconds) {
		    issue.seconds = issue.seconds + item.timeSpentSeconds;
                    seconds = seconds + item.timeSpentSeconds;
                }
		if (!issue.includeInReport && $scope.reportLogFilter(item))
		    issue.includeInReport = 1;
            })
	});
        $scope.workedSeconds = seconds;
    });
}

function WeekController($scope, $routeParams, Worklog) {

    var week = $routeParams.week;
    var start = moment(week);
    var monday = moment(week).startOf('isoWeek');

    if (!start.isSame(monday)) {
        // FIXME: improve wording.
        $scope.error = "Not a monday";
    }
       
    start.hour(5);
    var end = moment(start);
    end.add('days', 7);
    $scope.start = start;

    $scope.week = $routeParams.week;
    $scope.previousWeek = moment(monday).subtract('days', 7).format('YYYY-MM-DD');
    $scope.nextWeek = moment(monday).add('days', 7).format('YYYY-MM-DD');


    // FIXME: figure why it's invoked twice.
    console.log("WeekController");

    $scope.users = []    
    $scope.perUser = []
    for (var u in $scope.clientConfig.users) {
        $scope.users.push(u);
	$scope.perUser[u] = 0;
    }
    
    var until = moment(start);
    until.add('days', 7);

    $scope.selectedUsers = {};
    $scope.workedIssues = 0;
    $scope.workedSeconds = 0;

    var defaultUser = $scope.clientConfig.defaultUser;
    $scope.selectedUsers[defaultUser] = true;
    $scope.fullName = $scope.clientConfig.users[defaultUser];
    $scope.perUser = {}


    var scope = $scope;

    $scope.updateCounters = function() {
        
        //var f = $scope.issues.filter($scope.issueFilter);
    }

    $scope.issueFilter = function(issue) {
        for (var i = 0; i < issue.log.length; ++i) {
            var entry = issue.log[i];
            if ($scope.selectedUsers[entry.author] == true)
                return true;
        }
        return false;
    }

    $scope.issueTotalHours = function(issue) {
        var result = 0;
        for (var user in $scope.selectedUsers)
            result += issue.totals[user];
        return result;
    }

    $scope.logFilter = function(item) { 
        return scope.selectedUsers[item.author] == true;
    };     

    $scope.select = function(user) {
        $scope.selectedUsers = {};
        $scope.selectedUsers[user] = true;
        $scope.fullName = $scope.clientConfig.users[user];
        $scope.updateCounters();
    }

    var params = {
        since: start.toISOString(),
        until: until.toISOString(),
        users: $scope.users.join(',')
    };
    $scope.issues = Worklog.query(params, function() {
        $scope.workedIssues = $scope.issues.length;
        var seconds = 0;        
        for (var i = 0; i < $scope.issues.length; ++i) {
            var issue = $scope.issues[i];
            issue.log.forEach(function (item) {

		if (item.timeSpentSeconds)
		{
		    var current = $scope.perUser[item.author] || 0;
		    $scope.perUser[item.author] = current + item.timeSpentSeconds;
		    seconds = seconds + item.timeSpentSeconds;
                }
            });            
        }
	$scope.workedSeconds = seconds;
    });

    $scope.pillClass = function(user) {
        var result = [];
        if ($scope.selectedUsers[user] == true) {
            result.push("active");
        }

        if ($scope.workedIssues != 0) {

            var hours = ($scope.perUser[user] || 0)/60/60;
            if (hours < 10) {
                result.push("badHours");
            } else if (hours < 20) {
                result.push("doubtfulHours");
            } else {
                result.push("goodHours");
            }
        }
        return result;
    }
}

function WeeklyTimesController($scope, $routeParams, Worklog) {

    var users = []
    for (var u in $scope.clientConfig.users) {
        users.push(u);
    }

    var since = moment("2012-01-01");
    var until = moment();


    var params = {
        since: since.toISOString(),
        until: until.toISOString(),
        users: users.join(',')
    };

    var raw = Worklog.query(params, function() {
        
        var data = [];
        raw.forEach(function(issue) {
            if (issue.log)
                issue.log.forEach(function(entry) {
                    if (entry.timeSpentSeconds) {
                        data.push({a: entry.author, d: new Date(entry.date), t: entry.timeSpentSeconds});
                    }
                })
        });
        

        var facts = crossfilter(data);

        // Create dataTable dimension
        var workByDate = facts.dimension(function (d) {
            return d.d;
        });
        
        var workByDateWeekly = workByDate
            .group(function(date) {
                return moment(date).startOf('isoWeek').toDate();
            })
            .reduceSum(function(entry) { 
                return entry.t/60/60/8/5; 
            });

        var timesChart = dc.barChart("#times-chart");
        
        timesChart.width(1140)
            .height(150)
            .margins({top: 10, right: 10, bottom: 20, left: 40})
            .dimension(workByDate)
            .group(workByDateWeekly)
            .transitionDuration(500)
            .centerBar(true)	
            .gap(1)
            .filter([3, 5])
            .x(d3.time.scale().domain([since.toDate(), until.toDate()]).nice(d3.time.day))
            .xUnits(d3.time.weeks)        
            .elasticY(true)
            .xAxis().tickFormat();
        timesChart.xAxis().tickFormat(d3.time.format("%Y-%m-%d"));
        

        dc.renderAll();
    });
}


function ListController($scope, $routeParams, List, $cookies)
{
    var listId = $routeParams.listId;
    var helpId = "showHelp_" + listId;

    $scope.selectedUsers = {};

    var cookie = $cookies[helpId];
    if (cookie == "false")
        $scope.showHelp = false;
    else if (cookie == "true")
        $scope.showHelp = true;
    else
        $scope.showHelp = false;

    for (var i = 0; i < $scope.clientConfig.lists.length; ++i) {
        var list = $scope.clientConfig.lists[i];
        if (list.id == $routeParams.listId) {
            $scope.list = list;
            break;
        }
    }

    $scope.updateCounts = function(issues) {
        if (!issues)
            return undefined;

        var users = {}
        issues.forEach(function(issue) {
            var name;
            if (issue.fields.assignee) {
                name = issue.fields.assignee.name;
            }
            if (!name) {
                name = "none";
            }
            if (users[name] == undefined)
                users[name] = 1;
            else
                users[name] = users[name] + 1;
        });

        function realName(name) {
            var rn;
            if (name in $scope.clientConfig.users) {
                rn = $scope.clientConfig.users[name];
            } else {
                rn = "Jira User";
            }
            return name;
            return rn.split(' ').map(function (n) { return n[0] + '.';}).join('');
        }

        var usersList = []
        for (name in users) {
            usersList.push({name: realName(name), count: users[name]});
        }
        usersList.sort(function(a, b) { 
            //return a.name.localeCompare(b.name); 
            return b.count - a.count;
        });

        return usersList;

        //data.labels = usersList.map(function(a) { return a.name; });
        //data.datasets[0].data = usersList.map(function(a) { return a.count; });

        //return {
	//    labels : usersList.map(function(a) { return a.name; }), //["January","February","March","April","May","June","July"],
	//    datasets : [
	//        {
	//	    fillColor : "rgba(151,187,205,0.5)",
	//	    strokeColor : "rgba(151,187,205,1)",
	//	    data: usersList.map(function(a) { return a.count; }) //[28,48,40,19,96,27,100]
	//        }
	//    ]
        //};
    }

    function updateIssues()
    {
        $scope.updatingList = 1;
        var list = List.get({id: $routeParams.listId}, function() {
            $scope.updatingList = 0;
            $scope.issues = list.issues;
            $scope.groups = list.groups;
            if (!list.issues || list.issues.length == 0) {
                $scope.issues = [];
                list.groups.forEach(function(g) {
                    $scope.issues = $scope.issues.concat(g.issues);
                });
            }

            if (list.users != false) {
                $scope.counts = $scope.updateCounts($scope.issues);
            }

            $scope.estimate = 0;
            $scope.issues.forEach(function(issue) {
                if (issue.fields.timetracking.remainingEstimateSeconds) {
                    $scope.estimate += issue.fields.timetracking.remainingEstimateSeconds;
                }
            });
            
        });
    }
    updateIssues();

    $scope.$watch('updating', function(newVal, oldVal) {
        if (oldVal == 1 && newVal == 0) {
            updateIssues();
        }
    });

    $scope.$watch('showHelp', function(newVal, oldVal) {
        $cookies[helpId] = newVal.toString();
    });

    $scope.userListClass = function(username) {

        var active = false;
        if (username == 'all' && Object.keys($scope.selectedUsers).length == 0)
            active = true;
        else if (username in $scope.selectedUsers) {
            active = true;
        }

        if (active) {
            return "active";
        } else {
            return null;
        }
    }

    $scope.userClicked = function(username) {

        if (username == 'all') {
            $scope.selectedUsers = {};
        } else {
            $scope.selectedUsers = {};
            $scope.selectedUsers[username] = true;
        }

        //if (username in $scope.selectedUsers) {
        //    delete $scope.selectedUsers[username];
        //} else {
        //    $scope.selectedUsers[username] = true;
        //}
    };

    $scope.issueFilter = function(issue) {
        if (Object.keys($scope.selectedUsers).length == 0)
            return true;
        return (issue.fields.assignee.name in $scope.selectedUsers);
    }
}

function SprintController($scope, $routeParams, $cookies, $http, Sprint)
{
    var helpId = "showHelp_sprint";
    var cookie = $cookies[helpId];

    if (cookie == "false")
        $scope.showHelp = false;
    else if (cookie == "true")
        $scope.showHelp = true;
    else
        $scope.showHelp = true;

    for (var i = 0; i < $scope.clientConfig.sprints.length; ++i) {
        var sprint = $scope.clientConfig.sprints[i];
        if (sprint.id == $routeParams.sprintId) {
            $scope.sprint = sprint;
            break;
        }
    }

    var now = new Date();
    var start = new Date($scope.sprint.start);
    var end = new Date($scope.sprint.end);
   
    $scope.relationToNow = 0;
    if (start.getTime() > now.getTime())
        $scope.relationToNow = 1;
    if (end.getTime() < now.getTime())
        $scope.relationToNow = -1;
    
    function updateSprint()
    {
        $scope.updatingSprint = 1;
        // If we directly assign to $scope.sprint here, the sprint name
        // and other interesting things in the template will become empty.
        // So, wait until after we've loaded the data.
        var wip = Sprint.get({id: $routeParams.sprintId}, function() {
            $scope.sprint = wip;            
            $scope.updatingSprint = 0;
        });
    }

    $scope.formatSprintEndStatus = function(issue)
    {
        if (["Resolved", "Closed", "Validated"].indexOf(issue.status) != -1) {
            return issue.status;
        } else if (issue.whiteboard) {
            return issue.whiteboard;
        } else {
            return "Unknown";
        }
    }

    $scope.plus_button_class = function(issue) {
        var user = $scope.session.username;
        if (user && issue.plusses && issue.plusses.indexOf(user) != -1)
            return "plussed";
    }

    $scope.plus = function(issue) {
        var user = $scope.session.username;
        if (user) {
            var add;
            if (issue.plusses === undefined) {
                issue.plusses = [];
            }
            var index = issue.plusses.indexOf(user);
            if (index != -1) {
                add = 0;
                issue.plusses.splice(index, 1)
            } else {
                add = 1;
                issue.plusses.push(user);
            }
            $http.post("api/plus?key=" + issue.key + "&user=" + user + "&add=" + add);
        }
    }

    $scope.$watch('updating', function(newVal, oldVal) {
        if (oldVal == 1 && newVal == 0) {
            updateSprint();
        }
    });

    $scope.$watch('showHelp', function(newVal, oldVal) {
        $cookies[helpId] = newVal.toString();
    });

    updateSprint();
}

function BurndownController($scope)
{
    $scope.issues = {
	labels : ["Apr 3", "Apr 4", "Apr 5", "Apr 8", "Apr 9"], //,"March","April","May","June","July"],
	datasets : [
	    {
		fillColor : "rgba(51,187,205,0.2)",
		strokeColor : "rgba(51,187,205,1)",
		pointColor : "rgba(51,187,205,1)",
		pointStrokeColor : "#fff",
		data : [28, 27, 26, 33, 30,7,7,7]
	    },
	    {
		fillColor : "rgba(0,187,0,0.2)",
		strokeColor : "rgba(0,187,0,1)",
		pointColor : "rgba(0,187,0,1)",
		pointStrokeColor : "#fff",
		data : [83, 82, 81, 74 , 70,7,7,7]
	    },
	    {
		fillColor : "rgba(220,0,0,0.2)",
		strokeColor : "rgba(220,0,0,1)",
		pointColor : "rgba(220,0,0,1)",
		pointStrokeColor : "#fff",
		data : [20, 20, 21, 23, 19,7,7,7]
	    },
	    {
		fillColor : "rgba(255,255,0, 0)",
		strokeColor : "rgba(255,255,0, 1)",
		pointColor : "rgba(255,255,0, 1)",
		pointStrokeColor : "#fff",
		data : [80, 80, 74, 75, 67,7,7,7]
	    }
	]
    }
}
