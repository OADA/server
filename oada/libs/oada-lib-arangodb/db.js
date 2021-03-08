'use strict';

const Bluebird = require('bluebird');
const { Database } = require('arangojs');

const config = require('./config');
const db = new Database({
  url: config.get('arangodb:connectionString'),
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
const query = db.query;
db.query = function (...args) {
  let tries = 0;
  function tryquery() {
    return Bluebird.resolve(query.apply(db, args)).catch(
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
