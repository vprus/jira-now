'use strict';

angular.module('jiraNow.directives', [])
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
    });




