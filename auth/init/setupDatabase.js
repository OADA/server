// This file exports a function which can be used to initialize the database
// with `npm run init` in oada-ref-auth-js

const Database  = require('arangojs').Database;
const _ = require('lodash');
const Promise = require('bluebird');
const bcrypt = require('bcrypt');

// Allow oada-ref-auth-js to pass us the config, avoiding circular requires
module.exports = config => {

  console.log('WE ARE IN SETUP!');

  const db = new Database(config.get('arango:connectionString'));
  const dbname = config.get('arango:database');
  return db.get()
  .then(info => db.listDatabases())
  .then(dbs => {
    dbs = _.filter(dbs, d => d === dbname);
    if (dbs.length > 0) return console.log('database '+dbname+' exists');
    console.log('database '+dbname+' does not exist.  Creating...');
    return db.createDatabase(dbname)
    .then(() => console.log('Now '+dbname+' database exists'));
  }).then(() => {
     // XXX STOPPED HERE: look at test file for how to create and index collections.
  });
};
