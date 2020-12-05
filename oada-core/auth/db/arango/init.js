// NOTE: THIS IS DEPRECATED.  USE THE @oada/lib-arangodb INIT INSTEAD

// This file exports a function which can be used to initialize the database
// with `npm run init` in oada-ref-auth-js

const debug = require('debug')('arango/init');
const Database = require('arangojs').Database;
const _ = require('lodash');
const Promise = (global.Promise = require('bluebird'));
const bcrypt = require('bcryptjs');

// Allow oada-ref-auth-js to pass us the config, avoiding circular requires
module.exports = (config) => {
  debug('Checking for db setup');

  //------------------------------------------------------------
  // First setup some shorter variable names:
  const db = new Database(config.get('arango:connectionString'));
  const dbname = config.get('arango:database');
  const cols = config.get('arango:collections');
  const colnames = _.values(cols);
  // Get users, hash passwords in case we need to save:
  const defaultusers = _.map(config.get('arango:defaultusers'), (u) => {
    u.password = bcrypt.hashSync(u.password, config.get('server:passwordSalt'));
    return u;
  });
  const indexes = [
    { collection: 'users', index: 'username' },
    { collection: 'clients', index: 'clientId' },
    { collection: 'tokens', index: 'token' },
    { collection: 'codes', index: 'code' },
  ];

  //---------------------------------------------------------------------
  // Start the show: Figure out if the database exists: if not, make it
  return db
    .get()
    .then((info) => db.listDatabases())
    .then((dbs) => {
      dbs = _.filter(dbs, (d) => d === dbname);
      if (dbs.length > 0) return debug('database ' + dbname + ' exists');
      debug('database ' + dbname + ' does not exist.  Creating...');
      return db
        .createDatabase(dbname)
        .then(() => debug('Now ' + dbname + ' database exists'));

      //---------------------------------------------------------------------
      // Use that database, then check that all the collections exist
    })
    .then(() => {
      db.useDatabase(dbname);
      return db.listCollections();
    })
    .then((dbcols) => {
      return Promise.each(colnames, (c) => {
        if (_.find(dbcols, (d) => d.name === c)) {
          return debug('Collection ' + c + ' exists');
        }
        return db
          .collection(c)
          .create()
          .then(() => debug('Collection ' + c + ' has been created'));
      });

      //---------------------------------------------------------------------
      // Now check if the proper indexes exist on each collection:
    })
    .then(() => indexes)
    .map((ind) => db.collection(ind.collection).indexes())
    .map((dbindexes, i) => {
      // dbindexes looks like [ { fields: [ 'token' ], sparse: true, unique: true },... ]
      const index = indexes[i]; // { collection: 'tokens', index: 'index' }
      const hasindex = _.find(
        dbindexes,
        (i) => _.includes(i.fields, index.index) && i.sparse && i.unique
      );
      if (hasindex)
        return debug(
          'Index ' + index.index + ' exists on collection ' + index.collection
        );
      return db
        .collection(index.collection)
        .createHashIndex(index.index, { unique: true, sparse: true })
        .then(() =>
          debug('Created ' + index.index + ' index on ' + index.collection)
        );

      //----------------------------------------------------------------------
      // Finally, insert default users if they want some:
    })
    .then(() => defaultusers || [])
    .map((u) =>
      db
        .collection('users')
        .firstExample({ username: u.username })
        .then(() => debug('User ' + u.username + ' exists.'))
        .catch(() => {
          debug('saving user ' + u);
          return db
            .collection('users')
            .save(u)
            .then(() => debug('Created user ' + u.username));
        })
    );
};
