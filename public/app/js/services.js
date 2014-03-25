'use strict';

/* Services */


// Demonstrate how to register services
// In this case it is a simple value service.
angular.module('jiraNow.services', ['ngResource'])
    .factory('Week', function($resource) {
        return $resource('api/changes?user=:users&since=:since', {}, {
            query: {method:'GET', params:{}, isArray:true}
        });
    })
    .factory('Worklog', function($resource) {
        return $resource('api/changes?user=:users&since=:since&until=:until', {}, {
            query: {method:'GET', params:{}, isArray:true}
        });
    })
    .factory('List', function($resource) {
        return $resource('api/list/?id=:id', {}, {
            query: {method:'GET', params:{}, isArray:true}
        });
    })
    .factory('Sprint', function($resource) {
        return $resource('api/sprint/?id=:id', {}, {
            query: {method: 'GET', params: {}, isArray: true}
        });
    })
;
     




angular.module('developmentProcess', []).
    factory('sprintSchedule', function() {

        return {

            // Return the nearest date that falls on specified day
            // and hour.
            getPreviousDate: function(date, day, hour) {
                var d = new Date(date), now = new Date();
                d.setDate(d.getDate() - (d.getDay() + 7 - day) % 7);
                d.setHours(hour);
                d.setMinutes(0);
                d.setSeconds(0);
                d.setMilliseconds(0);
                if (d.getTime() > now.getTime()) {
                    d.setDate(d.getDate() - 7);
                }
                return d;
            },

            getMonday: function() {
                // Return previous monday, 5 am, local time
                return this.getPreviousDate(new Date(), 1, 5)
            },

            getPreviousMonday: function() {                
                var d = this.getMonday();
                d.setDate(d.getDate() - 7);
                return d;
            },
            
            getTeamCall: function() {
                // Current date, local time.
                var d = new Date();
                // Translate to Moscow time, (GMT+4)
                var moscowOffset = -4*60;
                var localToMoscowMillis = (d.getTimezoneOffset() - moscowOffset) * 60 * 1000;
                d.setTime(d.getTime() + localToMoscowMillis);
                // Previous Tuesday, 21:00, Moscow time
                d = this.getPreviousDate(d, 2, 21);
                // And back to local timezone
                d.setTime(d.getTime() - localToMoscowMillis);

                return d;                              
            },
            
            getPreviousTeamCall: function() {
                var d = this.getTeamCall();
                d.setDate(d.getDate() - 7);
                return d;
            }
        }
    });
