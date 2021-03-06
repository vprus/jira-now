'use strict';

angular.module('jiraNow', ['ngRoute', 'jiraNow.filters', 'jiraNow.services', 'jiraNow.directives', 'developmentProcess', "$strap.directives", "ngCookies"])
    .config(
        ['$routeProvider', function($routeProvider) {
            console.log("Init router");
            $routeProvider.when('/home', {templateUrl: 'partials/home.jade'});
            $routeProvider.when('/list/:listId', {templateUrl: 'partials/list.jade'});
            $routeProvider.when('/burndown', {templateUrl: 'partials/burndown.jade'});
            $routeProvider.when('/personal/week/:week', {templateUrl: 'partials/personal.jade'});
            $routeProvider.when('/personal', {
                redirectTo: function(params, location, search) {
                    var week = moment().startOf('isoWeek').format('YYYY-MM-DD');
                    return '/personal/week/' + week;
                }
            });
            $routeProvider.when('/team/week/:week', {templateUrl: 'partials/week.jade'});
            $routeProvider.when('/team', {
                redirectTo: function(params, location, search) {
                    var week = moment().startOf('isoWeek').format('YYYY-MM-DD');
                    return '/team/week/' + week;
                }
            });	    
            $routeProvider.when('/team/weekly-times', {templateUrl: 'partials/weekly-times.jade'});
            $routeProvider.when('/sprint/:sprintId', {templateUrl: 'partials/sprint.jade'});
            $routeProvider.otherwise({redirectTo: '/home'});
        }])
     ;
