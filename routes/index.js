
/*
 * GET home page.
 */

exports.index = function(req, res){
  res.render('index');
};

exports.partials = function (req, res) {
  var name = req.params.name;
  res.render('partials/' + name);
};

exports.setup = function (req, res) {
  var d = new Date();
  d.setTime(d.getTime() + 6*30*24*60*60*1000);
  res.cookie('clientConfig', req.params.clientConfig, { expires: d});
  res.redirect("/");
}