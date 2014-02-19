
var express = require('express'),
  routes = require('./routes'),
  api = require('./routes/api');

var app = module.exports = express();

// Configuration

app.configure(function(){
  app.engine('jade', require('jade').__express);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.cookieParser());
  app.use(express.methodOverride());
  app.use(express.static(__dirname + '/public'));
  app.use(app.router);
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function(){
  app.use(express.errorHandler());
});

// Routes for HTML pages
app.get('/', routes.index);
app.get('/partials/:name', routes.partials);

// Magic URL for initial setup
app.get('/setup/:clientConfig', routes.setup);

// Before doing any API calls, do some basic checks
app.get('/api/*', api.check)
app.post('/api/*', api.check)

// Actual API calls
app.get('/api/status', api.status);
app.get('/api/clientConfig', api.clientConfig);
app.get('/api/changes', api.changes)
app.get('/api/list', api.list)
app.get('/api/sprint', api.sprint)

app.post('/api/update', api.update)
app.post('/api/usage', api.record_usage);

// Everything else goes to index.
app.get('*', routes.index);

app.listen(3000, function(){
  console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
