'use strict';

angular.module('jiraNow', ['ngRoute', 'jiraNow.filters', 'jiraNow.services', 'jiraNow.directives', 'developmentProcess', "$strap.directives", "ngCookies"])
    .config(
        ['$routeProvider', function($routeProvider) {
            console.log("Init router");
            $routeProvider.when('/home', {templateUrl: 'partials/home.jade'});
            $routeProvider.when('/list/:listId', {templateUrl: 'partials/list.jade'});
            $routeProvider.when('/burndown', {templateUrl: 'partials/burndown.jade'});
            $routeProvider.when('/personal/:user/week/:week', {templateUrl: 'partials/personal.jade'});
            $routeProvider.when('/personal/:user', {
                redirectTo: function(params, location, search) {
                    var week = moment().startOf('isoWeek').format('YYYY-MM-DD');
                    return '/personal/' + params.user + '/week/' + week;
                }
            });
            $routeProvider.when('/week/since/:since', {templateUrl: 'partials/week.jade'});
            $routeProvider.when('/sprint/:sprintId', {templateUrl: 'partials/sprint.jade'});
            $routeProvider.otherwise({redirectTo: '/home'});
        }])
     ;
