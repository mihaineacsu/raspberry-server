var mongoose = require('mongoose'),
	autoIncrement = require('mongoose-auto-increment'),
	config = require('./config/config'),
	async = require('async');

var connection = mongoose.createConnection(config.get('MONGOLAB_URI'));

autoIncrement.initialize(connection);

var Schema = mongoose.Schema;

/*
 ** Device schema
 */
var deviceSchema = new Schema(
	{
		_id: Number,
		MAC: String
	},
	{
		collection: 'Devices'
	}
);
deviceSchema.plugin(autoIncrement.plugin, {model: 'Device', field: '_id'});


/*
 ** Device schema
 */
var probeSchema = new Schema(
	{
		_id: Number,
		ActiveDevice: {type: Number, ref: 'Device'},
		State: String,
		CurrentState: {type: Number, ref: 'State'},
		LatestHeartbeat: Date,
		NextHeartbeat: Date,
		WanIP: String,
		LanIP: String
	},
	{
		collection: 'Probes'
	}
);
probeSchema.plugin(autoIncrement.plugin, {model: 'Probe', field: '_id'});
probeSchema.methods.setState = function(state, callback){
	if (Object.prototype.toString.call(state) !== '[object String]')
		return callback(new Error("setState method expects 'state' parameter to be a string"));

	var stateLowercase = state.toLowerCase(),
		stateCapitalized = state[0].toUpperCase() + stateLowercase.substring(1);

	if (stateLowercase.localeCompare('up') != 0 &&
		stateLowercase.localeCompare('down') != 0)
		return callback(new Error("setState method expects 'state' parameter to be either 'up' or 'down'"));

	var thisProbe = this;

	thisProbe.State = stateCapitalized;

	var newEventParams = {
		Probe: thisProbe._id,
		Type: 'probe.' + stateLowercase
	};

	connection.model('Event', eventSchema).create(newEventParams, function(err){
		if (err)
			return callback(err);

		async.waterfall([
			function(next){
				var currentDate = Date.now();
				connection.model('State', stateSchema)
						  .findOneAndUpdate({_id: thisProbe.CurrentState}, {End: currentDate}, function(err){
						  	next(err, currentDate);
				});

			},
			function(currentDate, next){
				var newStateParams = {
					Probe: thisProbe._id,
					Start: currentDate,
					State: stateCapitalized
				};

				connection.model('State', stateSchema)
						  .create(newStateParams, function(err, newState){
						  	next(err, newState);
						  });
			},
		], function(err, newState){
			if (err)
				return callback(err);

			thisProbe.CurrentState = newState._id;
			thisProbe.save(function(err){
				return callback(err);
			});
		});
	});
};


/*
 ** State schema
 */
var stateSchema = new Schema(
	{
		_id: Number,
		Probe: {type: Number, ref: 'Probe'},
		Start: Date,
		End: Date,
		State: String,
	},
	{
		collection: 'States'
	}
);
stateSchema.plugin(autoIncrement.plugin, {model: 'State', field: '_id'});


/*
 ** Events schema
 */
var eventSchema = new Schema(
	{
		_id: Number,
		Probe: {type: Number, ref: 'Probe'},
		Type: String,
		TimeStamp: {type: Date, default: Date.now},
	},
	{
		collection: 'Events'
	}
);
eventSchema.plugin(autoIncrement.plugin, {model: 'Event', field: '_id'});


/*
 ** Heartbeat schema
 */
var heartbeatSchema = new Schema(
	{
		_id: Number,
		Probe: {type: Number, ref: 'Probe'},
		TimeStamp: Date,
		WanIP: String,
		LanIP: String,
		Server: String,
		Success: Boolean,
		Error: String,
		Latency: Number
	},
	{
		collection: 'Heartbeats'
	}
);
heartbeatSchema.plugin(autoIncrement.plugin, {model: 'Heartbeat', field: '_id'});


/*
 ** SpeedTest schema
 */
var speedTestSchema= new Schema(
	{
		_id: Number,
		Probe: {type: Number, ref: 'Probe'},
		TimeStamp: Date,
		WanIP: String,
		LanIP: String,
		Server: String,
		Success: Boolean,
		Error: String,
		Latency: Number,
		Down: Number,
		Up: Number
	},
	{
		collection: 'SpeedTests'
	}
);
speedTestSchema.plugin(autoIncrement.plugin, {model: 'SpeedTest', field: '_id'});


module.exports = {
				 Device: connection.model('Device', deviceSchema),
				 Probe: connection.model('Probe', probeSchema),
				 State: connection.model('State', stateSchema),
				 Event: connection.model('Event', eventSchema),
				 Heartbeat: connection.model('Heartbeat', heartbeatSchema),
				 SpeedTest: connection.model('SpeedTest', speedTestSchema)
				};
