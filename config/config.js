var nconf = require('nconf');

nconf.argv().env();

nconf.defaults({
    'MONGOLAB_URL': 'mongodb://localhost/Rasberry',
	'PORT': 8000,
});

module.exports = nconf;
