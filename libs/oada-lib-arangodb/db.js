'use strict';

const Promise = require('bluebird');
const arangojs = require('arangojs');
const config = require('./config');

const db = arangojs({
  url: config.get('arangodb:connectionString'),
  promise: Promise
});

if (config.get('isTest')) {
  config.set('arangodb:database', 'oada-test');
}

db.useDatabase(config.get('arangodb:database'));

module.exports = db;
