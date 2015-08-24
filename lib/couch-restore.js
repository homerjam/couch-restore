var Nano = require('nano'),
    Promise = require('bluebird'),
    program = require('commander'),
    fs = Promise.promisifyAll(require('fs'));

program
    .version('0.0.1')
    .usage('[options] <file> <database>')
    .option('-U, --url <url>', 'Couchdb url eg. http://username:password@domain:port')
    .option('-F, --force', 'Delete database if it exists')
    .parse(process.argv);

if (program.args.length < 2) {
    program.help();
}

var fileName = program.args[0];
var dbName = program.args[1];
var force = program.force === true;

// Grab couchdb username/password from .couch file or --username/--password args
var getCouchConfig = function() {
    return new Promise(function(resolve, reject) {
        if (program.url) {
            return resolve({
                url: program.url
            });
        }

        fs.readFileAsync('.couch').then(function(data) {
            resolve(JSON.parse(data));
        }, function(err) {
            switch (err.code) {
                case 'ENOENT':
                    reject(Error('.couch config not found'));
                    break;
            }
        });
    });
};

// Load backup
var loadBackup = function(config) {
    return new Promise(function(resolve, reject) {
        fs.readFileAsync(fileName).then(function(data) {
            resolve({
                config: config,
                backup: JSON.parse(data)
            });
        }, function(err) {
            switch (err.code) {
                case 'ENOENT':
                    reject(Error(fileName + ' not found'));
                    break;
            }
        });
    });
};

var verfiyDatabase = function(opts) {
    return new Promise(function(resolve, reject) {
        var nano = Nano(opts.config.url);

        opts.db = nano.use(dbName);

        var createDatabase = function() {
            nano.db.create(dbName, function(err, body) {
                if (err) {
                    return reject(Error('Couldn\'t create database, reason: ' + err.reason));
                }

                return resolve(opts);
            });
        };

        nano.db.get(dbName, function(err, body) {
            if (err) {
                if (err.statusCode === 404) {
                    return createDatabase();
                }

                reject(Error('Couldn\'t verify database, reason: ' + err.reason));

            } else {
                var empty = body.doc_count === 0 && body.doc_del_count === 0;

                if (empty) {
                    return resolve(opts);
                }

                if (!empty) {
                    if (force) {
                        return nano.db.destroy(dbName, function(err, body) {
                            if (err) {
                                return reject(Error('Couldn\'t destroy database, reason: ' + err.reason));
                            }

                            createDatabase();
                        });

                    } else {
                        return reject(Error('Database exists and is not empty, try using --force to destroy it'));
                    }
                }
            }
        });
    });
};

// Restore docs to database
var restoreDatabase = function(opts) {
    return new Promise(function(resolve, reject) {
        var docs = opts.backup.rows.map(function(row) {
            var doc = row.doc;
            delete doc._rev;
            return doc;
        });

        opts.db.bulk({
            docs: docs
        }, function(err, body) {
            if (err) {
                return reject(Error('Failed to restore database, reason: ' + err.reason));
            }

            reject('Succesfully restored database');
        });
    });
};

// Perform task
getCouchConfig()
    .then(loadBackup)
    .then(verfiyDatabase)
    .then(restoreDatabase)
    .then(function(result) {
        console.log(result);
    })
    .catch(function(error) {
        console.error('%s', error);
    });
