'use strict';

angular.module('jiraNow', ['jiraNow.filters', 'jiraNow.services', 'jiraNow.directives', 'developmentProcess', "$strap.directives"])
    .config(
        ['$routeProvider', function($routeProvider) {
            console.log("Init router");
            $routeProvider.when('/home', {templateUrl: 'partials/home.jade'});
            $routeProvider.when('/list/:listId', {templateUrl: 'partials/list.jade'});
            $routeProvider.when('/burndown', {templateUrl: 'partials/burndown.jade'});
            $routeProvider.when('/week/since/:since', {templateUrl: 'partials/week.jade'});
            $routeProvider.when('/sprint/:sprintId', {templateUrl: 'partials/sprint.jade'});
            $routeProvider.otherwise({redirectTo: '/home'});
        }])
     ;
