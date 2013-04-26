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
                result.push(weeks + " weeks");
                hours -= weeks*5*8;
                days = hours/8;
            }

            if (days >= 1) {
                result.push(days + " days");
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
    });
