'use strict';

angular.module('jiraNow.filters', [])
    .filter('formatDuration', function() {
        return function(input) {
            if (input == undefined || input == 0)
                return 0;

            var result = [];

            var hours = input/60/60;
            var days = hours/8;
            var weeks = days/5;

            if (weeks >= 1) {
                result.push(weeks.toPrecision(2) + " weeks");
                hours -= weeks*5*8;
                days = hours/8;
            }

            if (days >= 1) {
                result.push(days.toPrecision(2) + " days");
                hours -= days*8;
            }

            if (hours > 0) {
                result.push(hours.toPrecision(2) + " hours");
            }
            
            return result.join(", ");
        }
    })
    .filter('formatHours', function() {
        return function(input) {
            if (input == undefined || input == 0)
                return 0;

            return Math.ceil(input/60/60);
        }
    })
    .filter('updatedAgo', function($q) {
        return function(input) {
            if (!input)
                return null;
            else if (input == "updating")
                return "Updating...";
            else
                return "Updated " + moment(input).from(Math.round(new Date().getTime()));
        };
    }).
    filter('ago', function() {
        return function(input) {
            return moment(input).from();
        }
    })
    .filter('iif', function() {
        return function(input, thenValue, elseValue) {
            return input ? thenValue : elseValue;
        }
    })
    .filter('sprintStatusTitle', function () {
        return function(input) {
            var now = new Date();
            var end = new Date(input.end);
            
            console.log("input is " + end);
            if (now.getTime() > end.getTime())
                return "Status at sprint end";
            else
                return "Status so far";
        };
    });
