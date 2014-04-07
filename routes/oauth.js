
var config = require('../config');
var fs = require('fs');
var OAuth = require('oauth').OAuth;

var privateKeyData = fs.readFileSync(config.jira.oauthPrivateKeyFile, "utf8");

var url = "http://" + config.jira.host + ":" + config.jira.port;

var request_token_url = url + "/plugins/servlet/oauth/request-token";
var access_token_url = url + "/plugins/servlet/oauth/access-token";
var authorize_url = url + "/plugins/servlet/oauth/authorize";


var consumer = 
  new OAuth(request_token_url,
            access_token_url,
            config.jira.oauthConsumerKey,
            "",
            "1.0",
            config.server.url + "/oauth",
            "RSA-SHA1",
	    null,
	    privateKeyData);

exports.login = function(req, res) {
    console.log("OAuth login");
    consumer.getOAuthRequestToken(
        function(error, oauthToken, oauthTokenSecret, results) {
    	    if (error) {
	        console.log("Oauth login error: " + JSON.stringify(error));
                res.send(500, error.toString());
	    }
    	    else {
                req.session.oauthRequestToken = oauthToken;
      		req.session.oauthRequestTokenSecret = oauthTokenSecret;
                res.redirect(authorize_url + "?oauth_token=" + oauthToken);
	    }
        }
    )
}

exports.callback = function(req, res) {
    console.log("OAuth callback");
    consumer.getOAuthAccessToken (
        req.session.oauthRequestToken,
        req.session.oauthRequestTokenSecret,
        req.query.oauth_verifier,
        function(error, oauthAccessToken, oauthAccessTokenSecret, results){			
	    if (error) { 
	        console.log(error.data);
	        res.send("error getting access token");		
	    }
    	    else {
      	        req.session.oauthAccessToken = oauthAccessToken;
      	        req.session.oauthAccessTokenSecret = oauthAccessTokenSecret;
      	        consumer.get(
                    "http://jira.alm.mentorg.com:8080/rest/auth/1/session", 
		    req.session.oauthAccessToken, 
		    req.session.oauthAccessTokenSecret, 
		    "application/json",
		    function(error, data, resp){
			console.log("GOT " + data);
                        var j = JSON.parse(data);

      	                consumer.get(
                            "http://jira.alm.mentorg.com:8080/rest/api/2/user?username=" + j.name,
		            req.session.oauthAccessToken, 
		            req.session.oauthAccessTokenSecret, 
		            "application/json",
                            function(error, data, resp) {
                                console.log("USER " + data);
                                var j = JSON.parse(data);
                                req.session.username = j.name;
                                req.session.fullName = j.displayName; 
                                res.redirect(config.server.url);
                            }
                        )
		    }
		);
	    }
        }
    )    
}
