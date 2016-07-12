'use strict';
var pg = require('pg');
var config = require('config');

if ( config.has('db.poolSize')){
    pg.defaults.poolSize = config.get('db.poolSize');
}

// Helper Functions

// Handle errors with postgres driver
function handleError(err, client, done){
    // no error occurred, continue with the request
    if(!err) return false;
    // else close connection and hand back failure
    done(client);
    return true;
};

// Rollback helper for postgres transactions
function rollback(client, done){
    client.query('ROLLBACK', function(err) {
        return done(err);
    });
}

var dbURL = config.get('app.dbURL');
console.log(dbURL);
//var pool = new pg.Pool(dbURL);

/*pool.on('error', function (err, client) {
  console.error('idle client error', err.message, err.stack)
  client.end();
});
*/
exports.query = function(query, data, cb){
    var query = arguments[0];
    var cb = function(){};
    var data = [];

    if (typeof arguments[arguments.length-1] === 'function'){
        cb = arguments[arguments.length-1];
    }

    if (Array.isArray(arguments[1])){
        data = arguments[1];
    }

    pg.connect(dbURL, function(err, client, done){
        if(handleError(err, client, done)) return cb(err);
        client.query(query, data, function(err, result){
            if(handleError(err, client, done)) return cb(err);
            done();
            cb(null, result);
        });
    });
}