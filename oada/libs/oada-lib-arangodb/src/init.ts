/* Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @packageDocumentation
 *
 * This file exports a function which can be used to initialize the database
 * with `npm run init`.
 */

import Bluebird from 'bluebird';
import debug from 'debug';
import equal from 'deep-equal';
import arangojs from 'arangojs';

import * as users from './libs/users';

import config from './config';

const trace = debug('arango:init:trace');
const error = debug('arango:init:error');
const warn = debug('arango:init:warn');
const info = debug('arango:init:info');

// Can't use ./db because we're creating the actual database
const db = arangojs({
  url: config.get('arangodb.connectionString'),
});
db.database('_system');

//------------------------------------------------------------
// First setup some shorter variable names:
const dbname = config.get('arangodb.database');
const cols = config.get('arangodb.collections');
const colsarr = Object.values(cols);

async function run() {
  const ensureDefaults = config.get('arangodb.ensureDefaults');
  trace(
    `ensureDefaults = %s` +
      "==> false means it will delete default doc._id's from all collections if they exist, " +
      'and true means it will add them if they do not exist',
    ensureDefaults
  );

  trace('Checking if database exists');
  //---------------------------------------------------------------------
  // Start the show: Figure out if the database exists
  return (
    Bluebird.resolve(db.listDatabases())
      .then(async (dbs) => {
        dbs = dbs.filter((d) => d === dbname);
        if (dbs.length > 0) {
          if (
            (!config.get('isProduction') &&
              process.env.RESETDATABASE === 'yes') ||
            config.get('isTest')
          ) {
            trace(
              'isProduction is false and process.env.RESETDATABASE is "yes"' +
                'dropping database and recreating'
            );
            db.database('_system');
            return db
              .dropDatabase(dbname)
              .then(() => db.createDatabase(dbname));
          }
          info(
            'isProduction is ' + config.get('isProduction'),
            'and process.env.RESETDATABASE is ' +
              process.env.RESETDATABASE +
              'not dropping database.'
          );
          // otherwise, not test so don't drop database
          return trace('database ' + dbname + ' exists');
        }
        trace('Database ' + dbname + ' does not exist.  Creating...');
        return db
          .createDatabase(dbname)
          .then(() => trace('Now ' + dbname + ' database exists'));
      })
      .then(() => {
        //---------------------------------------------------------------------
        // Use that database, then check that all the collections exist
        trace('Using database ' + dbname);
        db.database(dbname);
        return db.listCollections();
      })
      .then(async (dbcols) => {
        trace('Found collections, looking for the ones we need');
        return Bluebird.each(colsarr, (c) => {
          if (dbcols.find((d) => d.name === c.name)) {
            return trace('Collection ' + c.name + ' exists');
          }
          if (c.edgeCollection) {
            return db
              .createEdgeCollection(c.name)
              .then(() =>
                trace('Edge collection ' + c.name + ' has been created')
              );
          } else {
            if (!c.createOptions) {
              c.createOptions = {};
            }
            return db.createCollection(c.name, c.createOptions).then(() => {
              trace('Document collection ' + c.name + ' has been created');
            });
          }
        });
      })
      .return(colsarr)
      //---------------------------------------------------------------------
      // Now check if the proper indexes exist on each collection:
      .map(
        (c) =>
          db
            .collection(c.name)
            .indexes()
            .then((dbindexes) => {
              // for each index in this collection, check and create
              return Bluebird.map(c.indexes, (ci) => {
                const indexname = typeof ci === 'string' ? ci : ci.name;
                const unique = typeof ci === 'string' ? true : ci.unique;
                const sparse = typeof ci === 'string' ? true : ci.sparse;
                if (dbindexes.find((dbi) => equal(dbi.fields, [indexname]))) {
                  trace(
                    'Index ' + indexname + ' exists on collection ' + c.name
                  );
                  return;
                }
                // Otherwise, create the index
                trace('Creating ' + indexname + ' index on ' + c.name);
                const fields = Array.isArray(indexname)
                  ? indexname
                  : [indexname];
                // @ts-ignore IDK what this line is...
                if (c.collection) {
                  return Bluebird.resolve(
                    db.collection(c.name).ensureIndex({
                      type: 'hash',
                      fields,
                      unique,
                      sparse,
                    })
                  ).tap(() =>
                    trace('Created ' + indexname + ' index on ' + c.name)
                  );
                } else {
                  return Bluebird.resolve(
                    db.collection(c.name).ensureIndex({
                      type: 'hash',
                      fields,
                      unique,
                      sparse,
                    })
                  ).tap(() =>
                    trace('Created ' + indexname + ' index on ' + c.name)
                  );
                }
              });
            })

        //----------------------------------------------------------------------
        // Finally, import default data if they want some:
      )
      .then(() => Object.entries(config.get('arangodb.collections')))
      .map(async ([colname, colinfo]) => {
        trace('Setting up collection %s: %O', colname, colinfo);
        if (typeof colinfo.defaults !== 'string') {
          return; // nothing to import for this colname
        }
        const { default: data } = await import(colinfo.defaults);
        // override global ensureDefaults if this column explicitly specifies a value for it:
        const colSpecificEnsureDefaults =
          typeof colinfo.ensureDefaults !== 'undefined'
            ? colinfo.ensureDefaults
            : ensureDefaults;

        // TODO: clean up this any nonsense
        return Bluebird.map(data, async (doc: any) => {
          if (!doc || !doc._id) {
            warn('doc is undefined for collection %s', colinfo.name);
          }
          // Have to use _key if we want the key to be our key:
          if (!doc._key) {
            doc._key = doc._id.replace(/^[^\/]*\//, '');
          }
          if (colname === 'users') {
            // oidc users don't have password, so you need to check for existence
            if (doc.password) doc.password = users.hashPw(doc.password);
          }
          return db
            .collection(colname)
            .document(doc._id)
            .then((dbdoc) => {
              if (colSpecificEnsureDefaults) {
                trace(
                  'Default data document ' +
                    doc._id +
                    ' already exists on collection ' +
                    colname +
                    ', leaving it alone because ensureDefaults is truthy'
                );
                return;
              }
              info(
                'Default data document ' +
                  doc._id +
                  ' exists on collection ' +
                  colname +
                  ', and ensureDefaults is falsy, ' +
                  'so we are DELETING THIS DOCUMENT FROM THE DATABASE! ' +
                  'Before deleting, its value in the database was: ',
                JSON.stringify(dbdoc, null, '  ')
              );
              return db
                .collection(colname)
                .remove(doc._key)
                .catch((e) => {
                  warn(
                    'WARNING: Failed to remove default doc ' +
                      doc._key +
                      ' from collection ' +
                      colname +
                      '.  Error was: ',
                    e
                  );
                });
            })
            .catch(() => {
              if (colSpecificEnsureDefaults) {
                info(
                  'Document ' +
                    doc._key +
                    ' does not exist in collection ' +
                    colname +
                    '.  Creating...'
                );
                return db
                  .collection(colname)
                  .save(doc)
                  .then(() => {
                    trace(
                      'Document ' +
                        doc._id +
                        ' successfully created in collection ' +
                        colname
                    );
                  });
              }
              trace(
                'Default document ' +
                  doc._key +
                  ' does not exist in collection ' +
                  colname +
                  'so there is nothing else to do for this one.'
              );
              return;
            });
        });
      })
      .tapCatch((err) => {
        error(
          'ERROR: something went wrong. err = %O',
          err?.response ? err.response.body : err
        );
      })
  );
}

// cleanup will delete the test database if in test mode
async function cleanup() {
  if (config.get('isProduction')) {
    throw new Error(
      'Cleanup called, but isProduction is true!' +
        ' Cleanup only deletes the database when testing.'
    );
  }
  // arango only lets you drop databases from _system
  db.database('_system');
  trace(
    'Cleaning up by dropping test database %s',
    config.get('arangodb.database')
  );
  return db
    .dropDatabase(config.get('arangodb.database'))
    .then(() =>
      trace('Database %s dropped successfully', config.get('arangodb.database'))
    );
}

export { run, cleanup, config };
