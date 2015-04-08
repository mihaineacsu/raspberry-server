var async = require('async'),
    config = require('./config/config'),
    express = require('express'),
    models = require('./models');

var router = express.Router(),
    Device = models.Device,
    Probe = models.Probe,
    State = models.State,
    Event = models.Event,
    Heartbeat = models.Heartbeat,
    SpeedTest = models.SpeedTest;

/*
 * Error object that will contain all the missing parameters
 * It is used by checkParams function
 */
function MissingInputParamsError(paramArray) {
    Error.captureStackTrace(this);
    this.message = paramArray.join(', ');
    this.name = "MissingInputParamsError";
}
MissingInputParamsError.prototype = Object.create(Error.prototype);

function executeAsync(/*tasks*/) {
    var tasks = Array.prototype.concat.apply([], arguments);
    var nextTask = tasks.shift();

    nextTask(function(){
        if (tasks.length > 0)
            executeAsync.apply(this, tasks);
    });
}

/* 
 * Called within each endpoint handler and assures all the mandatory parameters
 * have been passed. If mandatory parameters are missing, records the missing
 * parameters and builds an error object with them.
 */
var checkParams = function(input, paramsArray, cb){
    // input - received parameters
    // paramsArray - mandatory parameters
    // cb - function to be called after checking is done

    var err = null,
        params = {},
        missingParams = [];

    for (var index in paramsArray) {
        var key = paramsArray[index];

        if (typeof input[key] !== 'undefined'){
            // all input parameters are strings - some of these need to be
            // converted to Number (ids, longitude, ...); if they can't be
            // converted to Number, they are kept as Strings
            if (isNaN(input[key]))
                params[key] = input[key];
            else
                params[key] = Number(input[key]);
        }
        else
            missingParams.push(key);
    }

    if (missingParams.length > 0)
        err = new MissingInputParamsError(missingParams);

    cb(err, params);
};

var runGenericActivities = function(params, callback){
    Device.findOne({MAC: params['MAC Address']}, function(err, foundDevice){
        if (err || foundDevice)
            return callback(err, params, foundDevice);

        async.waterfall([
            function(next){
                Device.create({MAC: params['MAC Address']}, next);
            },

            function(newDevice, next){
                var newProbeParams = {
                    ActiveDevice: newDevice._id,
                    State: 'New',
                    WanIP: params['WAN IP'],
                    LanIP: params['LAN IP']
                };

                Probe.create(newProbeParams, function(err, newProbe){
                    next(err, newDevice, newProbe);
                });
            },

            function(newDevice, newProbe, next){
                var newEventParams = {
                    Probe: newProbe._id,
                    Type: 'probe.created'
                };

                Event.create(newEventParams, function(err, newEvent){
                    next(err, newDevice, newProbe);
                });
            },

            function(newDevice, newProbe, next){
                var newEventParams = {
                    Probe: newProbe._id,
                    Type: 'probe.linked'
                };

                Event.create(newEventParams, function(err, newEvent){
                    next(err, newDevice, newProbe);
                });
            },

            function(newDevice, newProbe, next){
                var newStateParams = {
                    Probe: newProbe._id,
                    State: 'New',
                    Start: Date.now()
                };

                State.create(newStateParams, function(err, newState){
                    newProbe.CurrentState = newState._id;
                    newProbe.save(function(err){
                        next(err, newDevice)
                    });
                });
            }
        ], function(err, newDevice){
            return callback(err, params, newDevice);
        });
    });
};

router.post('/heartbeat', function(req, res, errCallback){
    var params = [
        'MAC Address',
        'API key',
        'WAN IP',
        'LAN IP',
        'Ping server',
        'Success',
        'Error',
        'Latency',
        'Next heartbeat'
    ];

    async.waterfall([
        function(next){
            checkParams(req.body, params, function(err, params){
                if (err)
                    return next(err);

                params['Success'] = (params['Success'] === 'True')
                runGenericActivities(params, next);
            });
        },
        function(params, device, next){
            var heartbeatParams = {
                TimeStamp: Date.now(),
                WanIP: params['WAN IP'],
                LanIP: params['LAN IP'],
                Server: params['Ping server'],
                Success: params['Success'],
                Error: params['Error'],
                Latency: params['Latency']
            };

            Heartbeat.create(heartbeatParams, function(err, newHeartbeat){
                next(err, params, device);
            });
        },
        function(params, device, next){
            Probe.findOne({ActiveDevice: device._id}, function(err, foundProbe){
                foundProbe.LatestHeartbeat = Date.now();
                foundProbe.NextHeartbeat = Date.now() + 1000 * 60 * params['Next heartbeat'];
                foundProbe.WanIP = params['WAN IP'];
                foundProbe.LanIP = params['LAN IP'];
                
                foundProbe.save(function(err){
                    if (err)
                        return next(err);
                });

                if (foundProbe.State.localeCompare('Up') == 0)
                    return next(null);
                else
                    foundProbe.setState('Up', next);
            });
        }
    ], function(err){
        if (err)
            return errCallback(err);

        res.send('All good!');
    });
});

router.post('/speedtest', function(req, res, errCallback){
    var params = [
        'MAC Address',
        'API key',
        'WAN IP',
        'LAN IP',
        'Speedtest server',
        'Success',
        'Error',
        'Latency',
        'Down',
        'Up'
    ];

    async.waterfall([
        function(next){
            checkParams(req.body, params, function(err, params){
                if (err)
                    return next(err);

                params['Success'] = (params['Success'] === 'True')
                runGenericActivities(params, next);
            });
        },
        function(params, device, next){
            var speedTestParams = {
                TimeStamp: Date.now(),
                WanIP: params['WAN IP'],
                LanIP: params['LAN IP'],
                Server: params['Speedtest server'],
                Success: params['Success'],
                Error: params['Error'],
                Latency: params['Latency'],
                Down: params['Down'],
                Up: params['Up']
            };

            SpeedTest.create(speedTestParams, function(err, newSpeedTest){
                next(err);
            });
        }
    ], function(err){
        if (err)
            return errCallback(err);

        res.send('All good!');
    });
});

router.get('/devices', function(req, res, errCallback){
    Device.find({}, function(err, devices){
        if (err)
            errCallback(err);

        res.send(JSON.stringify(devices, null, 2));
    });
});

router.get('/probes', function(req, res, errCallback){
    Probe.find({}, function(err, probes){
        if (err)
            errCallback(err);

        res.send(JSON.stringify(probes, null, 2));
    });
});

router.get('/states', function(req, res, errCallback){
    State.find({}, function(err, states){
        if (err)
            errCallback(err);

        res.send(JSON.stringify(states, null, 2));
    });
});

router.get('/events', function(req, res, errCallback){
    Event.find({}, function(err, events){
        if (err)
            errCallback(err);

        res.send(JSON.stringify(events, null, 2));
    });
});

router.get('/heartbeats', function(req, res, errCallback){
    Heartbeat.find({}, function(err, heartbeats){
        if (err)
            errCallback(err);

        res.send(JSON.stringify(heartbeats, null, 2));
    });
});

router.get('/speedtests', function(req, res, errCallback){
    SpeedTest.find({}, function(err, speedtests){
        if (err)
            errCallback(err);

        res.send(JSON.stringify(speedtests, null, 2));
    });
});

module.exports = router;
