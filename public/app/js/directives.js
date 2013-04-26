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
    });


