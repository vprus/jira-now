'use strict';

/* Controllers */

function AppController($scope, $http, $timeout, sprintSchedule) {

    $scope.loaded = 0;

    $scope.updating = 0;

    $scope.meta = {lastIssueSync: null};
   
    $http({method: 'GET', url: '/api/status'})
        .success(function(data, status, headers, config) {
            $scope.meta = data;
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

        return "Updated " + moment(time).from(Math.round(new Date().getTime()));
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

function WeekController($scope, $routeParams, Week) {
    // FIXME: figure why it's invoked twice.
    console.log("WeekController");

    $scope.users = []    
    for (var u in $scope.clientConfig.users) {
        $scope.users.push(u);
    }

    $scope.since = $routeParams.since;

    console.log("Date is " + $scope.since);

    $scope.selectedUsers = {};
    $scope.workedIssues = 0;
    $scope.workedSeconds = 0;

    var defaultUser = $scope.clientConfig.defaultUser;
    $scope.selectedUsers[defaultUser] = true;
    $scope.fullName = $scope.clientConfig.users[defaultUser];


    var scope = $scope;

    $scope.updateCounters = function() {
        
        var f = $scope.issues.filter($scope.issueFilter);
        $scope.workedIssues = f.length;
        var seconds = 0;
        for (var i = 0; i < f.length; ++i) {
            var issue = f[i];
            issue.log.forEach(function (item) {
                if (scope.selectedUsers[item.author] == true && item.timeSpentSeconds) {
                    seconds = seconds + item.timeSpentSeconds;
                }
            });            
        }
        $scope.workedSeconds = seconds;
    }

    $scope.issueFilter = function(issue) {
        for (var i = 0; i < issue.log.length; ++i) {
            var entry = issue.log[i];
            if ($scope.selectedUsers[entry.author] == true)
                return true;
        }
        return false;
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

    $scope.issues = Week.query({since: $scope.since, users: $scope.users.join(',')}, function() {
        $scope.updateCounters();
    });
}

function ListController($scope, $routeParams, List)
{
    console.log("List Controller: " + $routeParams.listId)

    for (var i = 0; i < $scope.clientConfig.lists.length; ++i) {
        var list = $scope.clientConfig.lists[i];
        if (list.id == $routeParams.listId) {
            $scope.name = list.name;
            break;
        }
    }

    $scope.updateCounts = function(issues) {
        if (!issues)
            return undefined;

        var users = {}
        issues.forEach(function(issue) {
            var name = issue.fields.assignee.name;
            if (users[name] == undefined)
                users[name] = 1;
            else
                users[name] = users[name] + 1;
        });
        console.log("users " + JSON.stringify(users, null, 4));

        var usersList = []
        for (name in users) {
            usersList.push({name: name, count: users[name]});
        }
        usersList.sort(function(a, b) { return a.name.localeCompare(b.name); });

        //data.labels = usersList.map(function(a) { return a.name; });
        //data.datasets[0].data = usersList.map(function(a) { return a.count; });

        return {
	    labels : usersList.map(function(a) { return a.name; }), //["January","February","March","April","May","June","July"],
	    datasets : [
	        {
		    fillColor : "rgba(151,187,205,0.5)",
		    strokeColor : "rgba(151,187,205,1)",
		    data: usersList.map(function(a) { return a.count; }) //[28,48,40,19,96,27,100]
	        }
	    ]
        };
    }

    $scope.issues = List.query({id: $routeParams.listId}, function() {
        console.log ("ISSUES " + $scope.issues);
        $scope.counts = $scope.updateCounts($scope.issues);        
    });

    $scope.$watch('updating', function(newVal, oldVal) {
        if (oldVal == 1 && newVal == 0) {
            $scope.updatingList = 1;
            $scope.issues = List.query({id: $routeParams.listId}, function() {
                $scope.updatingList = 0;
            });
        }
    });
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