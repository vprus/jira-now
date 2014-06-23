'use strict';

angular.module('jiraNow.directives', ['ng'])
    .directive('digester', function() {
        var digester = {
            replace: false,
            restrict: 'EA',
            // Create an isolated scope, so that we don't run digest on the
            // entire parent scope. We could pass something into this scope
            // using variables, but using $parent is just as convenient.
            //
            // See https://groups.google.com/forum/?hl=en-US&fromgroups=#!topic/angular/m3f1XMEybUk
            scope: {
            },
            link: function(scope, element, attrs){
                var interval = attrs.digester;
                setInterval(function() { scope.$digest(); }, interval);
            }
        }; 
        return digester; 
    })
    .directive('lineChart', function() {
        return {
            restrict: 'A',
            scope: { data: '=lineChart' },
            link: function(scope, element, attrs) {
                var ctx = element[0].getContext("2d");
                var chart = new Chart(ctx);
                chart.Line(scope.data, {});
            }
        };
    })
    .directive('barChart', function() {
        return {
            restrict: 'A',
            scope: { data: '=barChart' },
            link: function(scope, element, attrs) {
                console.log("Linking")
                var ctx = element[0].getContext("2d");
                var chart = new Chart(ctx);
                scope.$watch('data', function(val, oldVal) {
                    console.log("Drawing bar chart " + val + " " + oldVal);
                    if (val) {
                        chart.Bar(val, {});
                    }
                });
            }
        };
    })
    .directive('popover', function() {
        return { 
            restrict: 'A',
            link: function(scope, element, attrs) {
                attrs.$observe('dataTitle', function(value) {
                    $(element).popover({title: value});
                });
            }
        };
    })
    .directive('toggle', function() {
        return {
            restrict: 'A',
            scope: { variable: '=toggle' },
            link: function(scope, element, attrs) {
                console.log("TOGGLE");
                if (scope.variable != true && scope.variable != false) {
                    scope.variable = false;
                }
                var e = $(element);
                if (scope.variable) {
                    e.addClass("pressed");
                }
                e.click(function (event) {
                    scope.$apply(function () {
                        if (scope.variable == false) {
                            console.log("Set to true");
                            scope.variable = true;
                            e.addClass("pressed");
                        } else {
                            scope.variable = false;
                            e.removeClass("pressed");
                        }
                    });
                    event.preventDefault();
                });
            }
        }
    })
    .directive('sprintEndStatus', function() {
        return {
            restrict: 'A',
            scope: { issue: '=sprintEndStatus', sprint: '=' },
            link: function(scope, element, attrs) {
                var issue = scope.issue;
                var sprint = scope.sprint;
                var ctx = element[0];

                var state;
                if (["Resolved"].indexOf(issue.status) != -1) {
                    state = "<span style='color: green; font-weight: bold'>";
                    if (issue.statusNow == "Closed")
                        state += "&#x2713; ";
                    state += issue.status;
                    state += "</span>";
                    
                    if (issue.statusNow == "Closed" || issue.statusNow == "Validated") {
                        state = state + " &rarr; " + issue.statusNow;
                    } else if (issue.assigneeNow == "mmurtaza") {
                        state = state + " &rarr; In QA";
                    }
                    
                } else if (["Closed", "Validated"].indexOf(issue.status) != -1) {
                    state = "<span style='color: green; font-weight: bold'>&#x2713; " + issue.status + "</span>";
                } else if (issue.whiteboard) {
                    state = issue.whiteboard;
                } else {
                    var e = new Date(sprint.end);
                    var n = new Date();
                    if (n > e)
                        state = "<b style='color: red'>Not specified</b>";
                    else if (n > e - 5*24*60*60*1000) 
                        state = "<b style='color: red'>Not specified yet</b>";
                    else
                        state = "<b>Not specified yet</b>";                        
                }

                element.html(state);
            }
        };
    })
    .directive('timesheet', function() {
	return {
	    restrict: 'E',
	    scope: {
		data: "=",
		start: "=",
		user: "=",
	    },
	    templateUrl: "partials/timesheet.jade",
	    link: function(scope, element, attrs) {
		scope.count = 0;
		scope.updates = 0;
		scope.dates = []
		for (var i = 0; i < 7; ++i)
		{
		    var thisDay = moment(scope.start);
		    thisDay.add('days', i);
		    scope.dates.push(thisDay.date());
		}
		
		scope.$watch('data', function(issues, oldValue) {

		    scope.count = issues.length;
		    scope.updates = scope.updates + 1;

		    scope.workedIssues = 0;
		    scope.workedSeconds = 0;

		    scope.perIssuePerDay = {}
		    scope.dayTotal = {0: 0, 1: 0, 2:0, 3: 0, 4: 0, 5: 0, 6: 0};
   
		    var seconds = 0;
		    for (var i = 0; i < issues.length; ++i) {
			var issue = issues[i];
			issue.total = issue.totals[scope.user];
			issue.perDay = {0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0};
			issue.log.forEach(function (item) {
			    if (item.timeSpentSeconds) {
				seconds = seconds + item.timeSpentSeconds;
				var day = (new Date(item.date)).getDay();
				issue.perDay[day] = (issue.perDay[day] || 0) + item.timeSpentSeconds;
				scope.dayTotal[day] = scope.dayTotal[day] + item.timeSpentSeconds;
			    }
			});  
		    }
		    scope.workedSeconds = seconds;
		    scope.issues = issues.filter(function(issue) { return issue.total > 0; });
		    scope.issues.sort(function(a, b) { return b.total - a.total; });
		});

		scope.timesheetSelect = function($event, key, day) {

		    var newCell = $($event.target);
		    
		    if (scope.activeCell) {
			scope.activeCell.removeClass("active");
		    }

		    if ($event.target == scope.activeCellRaw) {
			scope.activeCellRaw = null;
			scope.activeCell = null;
			scope.timesheetCellDetails = [];
			return;
		    }

		    scope.activeCellRaw = $event.target;
		    scope.activeCell = $($event.target);
		    scope.activeCell.addClass("active");

		    scope.timesheetCellDetails = [];
		    for (var i = 0; i < scope.issues.length; ++i) {
			if (scope.issues[i].key == key) {
			    var issue = scope.issues[i];
			    for (var j = 0; j < issue.log.length; ++j) {
				var item = issue.log[j];
				var thisDay = (new Date(item.date)).getDay();
				if (thisDay == day)
				    scope.timesheetCellDetails.push(item);
			    }
			    break;
			}
		    }
		}

	    }	    
	};
    });




