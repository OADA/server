// This file exports a function which can be used to initialize the database
// with `npm run init`.

'use strict';

const config = require('./config');
const debug = require('debug');
const trace = debug('trace:arango#init');
const info = debug('info:arango#init');
const _ = require('lodash');
const users = require('./libs/users.js');
var Promise = require('bluebird');

// Can't use db.js's db because we're creating the actual database
const db = require('arangojs')({
  promise: Promise,
  url: config.get('arangodb:connectionString')
});
db.useDatabase('_system');

//------------------------------------------------------------
// First setup some shorter variable names:
const dbname = config.get('arangodb:database');
const cols = config.get('arangodb:collections');
const colsarr = _.values(cols);

module.exports = {
  run: () => {
    trace('Checking if database exists');
    //---------------------------------------------------------------------
    // Start the show: Figure out if the database exists
    return db.listDatabases()
    .then(dbs => {
      dbs = _.filter(dbs, d => d === dbname);
      if (dbs.length > 0) {
        if (!config.get('isProduction') &&
            process.env.RESETDATABASE === 'yes') {
          trace('isProduction is false and process.env.RESETDATABASE is "yes"',
              'dropping database and recreating');
          db.useDatabase('_system');
          return db.dropDatabase(dbname).then(() => db.createDatabase(dbname));
        }
        info('isProduction is ' + config.get('isProduction'),
            'and process.env.RESETDATABASE is ' + process.env.RESETDATABASE,
            'not dropping database.');
        // otherwise, not test so don't drop database
        return trace('database ' + dbname + ' exists');
      }
      trace('Database ' + dbname + ' does not exist.  Creating...');
      return db.createDatabase(dbname)
        .then(() => trace('Now ' + dbname + ' database exists'));

    }).then(() => {
      //---------------------------------------------------------------------
      // Use that database, then check that all the collections exist
      trace('Using database ' + dbname);
      db.useDatabase(dbname);
      return db.listCollections();
    }).then(dbcols => {
      trace('Found collections, looking for the ones we need');
      return Promise.each(colsarr, c => {
        if (_.find(dbcols, d => d.name === c.name)) {
          return trace('Collection ' + c.name + ' exists');
        }
        if (c.edgeCollection) {
          return db.edgeCollection(c.name).create()
          .then(() => trace('Edge collection ' + c.name + ' has been created'));
        } else {
          if (!c.createOptions) {
            c.createOptions = {};
          }
          return db.collection(c.name).create(c.createOptions).then(() => {
            trace('Document collection ' + c.name + ' has been created');
          });
        }
      });

    }).return(colsarr)
    //---------------------------------------------------------------------
    // Now check if the proper indexes exist on each collection:
    .map(c => db.collection(c.name).indexes()
      .then(dbindexes => {
        // for each index in this collection, check and create
        return Promise.map(c.indexes, ci => {
          const indexname = (typeof ci === 'string') ? ci : ci.name;
          const unique = (typeof ci === 'string') ? true : ci.unique;
          const sparse = (typeof ci === 'string') ? true : ci.sparse;
          if (_.find(dbindexes, dbi => _.isEqual(dbi.fields, [indexname]))) {
            trace('Index ' + indexname + ' exists on collection ' + c.name);
            return;
          }
          // Otherwise, create the index
          if (c.edgeCollection) {
            return db.edgeCollection(c.name)
              .createHashIndex(indexname, {unique, sparse})
              .tap(() => trace('Created ' + indexname + ' index on ' + c.name));
          } else {
            return db.collection(c.name)
              .createHashIndex(indexname, {unique, sparse})
              .tap(() => trace('Created ' + indexname + ' index on ' + c.name));
          }
        });
      })

    //----------------------------------------------------------------------
    // Finally, import default data if they want some:
    ).then(() => _.keys(config.get('arangodb:collections')))
    .map(colname => {
      const colinfo = config.get('arangodb:collections')[colname];
      if (typeof colinfo.defaults !== 'string') {
        return; // nothing to import for this colname
      }
      const data = require(colinfo.defaults);

      return Promise.map(data, doc => {
        if (!doc || !doc._id) {
          trace('WARNING: doc is undefined for collection ' + colinfo.name);
        }
        // Have to use _key if we want the key to be our key:
        if (!doc._key) {
          doc._key = doc._id.replace(/^[^\/]*\//, '');
        }
        if (colname === 'users') {
          // oidc users don't have password, so you need to check for existence
          if (doc.password) doc.password = users.hashPw(doc.password);
        }
        return db.collection(colname).document(doc._id)
          .then(() => trace('Default data document ' + doc._id +
              ' already exists on collection ' + colname))
          .catch(() => {
            trace('Document ' + doc._id +
                ' does not exist in collection ' + colname + '.  Creating...');
            return db.collection(colname).save(doc)
              .then(() => { trace('Document ' + doc._id +
                    ' successfully creatd in collection ' + colname); });
          });
      });
    }).catch(err => {
      if (err && err.response) {
        info('ERROR: something went wrong.  err.body = ', err.response.body);
      } else {
        info('ERROR: something went wrong.  err = ', err);
      }
    });
  },

  // cleanup will delete the test database if in test mode
  cleanup: () => {
    if (config.get('isProduction')) {
      throw new Error('Cleanup called, but isProduction is true!' +
          ' Cleanup only deletes the database when testing.');
    }
    // arango only lets you drop databases from _system
    db.useDatabase('_system');
    trace('Cleaning up by dropping test database ' +
        config.get('arangodb:database'));
    return db.dropDatabase(config.get('arangodb:database'))
      .then(() => trace('Database ' + config.get('arangodb:database') +
          ' dropped successfully'));
  },

  config: config,

};

