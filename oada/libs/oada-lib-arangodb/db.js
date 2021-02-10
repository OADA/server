'use strict';

var Promise = require('bluebird');
const arangojs = require('arangojs');
const debug = require('debug');
const warn = debug('arangodb#resources:warn');

const config = require('./config');
const db = arangojs({
  url: config.get('arangodb:connectionString'),
  promise: Promise,
});

if (config.get('isTest')) {
  config.set('arangodb:database', 'oada-test');
}

db.useDatabase(config.get('arangodb:database'));

// Automatically retry queries on deadlock?
const deadlockRetries = config.get('arangodb:retry:deadlock:retries');
const deadlockDelay = config.get('arangodb:retry:deadlock:delay');
const DeadlockError = {
  name: 'ArangoError',
  errorNum: 29,
};
let query = db.query;
db.query = function (...args) {
  let tries = 0;
  function tryquery() {
    return Promise.resolve(query.apply(db, args)).catch(
      DeadlockError,
      (err) => {
        if (++tries >= deadlockRetries) {
          return Promise.reject(err);
        }

        //      warn(`Retrying query due to deadlock (retry #${tries})`, err);
        return Promise.resolve().delay(deadlockDelay).then(tryquery);
      }
    );
  }

  return tryquery();
};

module.exports = db;
