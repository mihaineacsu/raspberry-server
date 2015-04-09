var config = require('./config/config'),
    express = require('express'),
    bodyParser = require('body-parser');
    routes = require('./routes'),
    script = require('./script');

var app = express();

app.use(express.static(__dirname + '/public'));

app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.use(function(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    next();
});

app.use('/', routes);

app.use(function(err, req, res, next) {
    if(!err)
        return next();

    console.log(err.stack);
    console.log(err);
	res.status(500);
	return res.send({
        type: err.name,
        message: err.message,
    });
});

app.listen(config.get('PORT'));

script();