var Probe = require('./models').Probe;
require('waitjs');

module.exports = function(){
    repeat('1 min', function() {
        Probe.find({NextHeartbeat: {$lt: Date.now()}, State: 'Up'}, function(err, foundProbes){
            if (err)
                return console.log(err);

            if (!foundProbes)
                return;

            for (var i in foundProbes){
                foundProbes[i].setState('Down', function(err){
                    if (err)
                        return console.log(err);
                });
            }
        });
    }, true);
};