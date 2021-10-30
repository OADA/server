/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// This file exports a function which can be used to initialize the database
// with `npm run init` in oada-ref-auth-js

const debug = require('debug')('arango/init');
const { Database } = require('arangojs');
const Promise = (global.Promise = require('bluebird'));
const bcrypt = require('bcryptjs');

// Allow oada-ref-auth-js to pass us the config, avoiding circular requires
module.exports = (config) => {
  debug('Checking for db setup');

  // ------------------------------------------------------------
  // First setup some shorter variable names:
  const database = new Database(config.get('arango:connectionString'));
  const dbname = config.get('arango:database');
  const cols = config.get('arango:collections');
  const colnames = Object.values(cols);
  // Get users, hash passwords in case we need to save:
  const defaultusers = config.get('arango:defaultusers').map((u) => {
    u.password = bcrypt.hashSync(u.password, config.get('server:passwordSalt'));
    return u;
  });
  const indexes = [
    { collection: 'users', index: 'username' },
    { collection: 'clients', index: 'clientId' },
    { collection: 'tokens', index: 'token' },
    { collection: 'codes', index: 'code' },
  ];

  // ---------------------------------------------------------------------
  // Start the show: Figure out if the database exists: if not, make it
  return database
    .get()
    .then(async () => database.listDatabases())
    .then((dbs) => {
      dbs = dbs.filter((d) => d === dbname);
      if (dbs.length > 0) return debug(`database ${dbname} exists`);
      debug(`database ${dbname} does not exist.  Creating...`);
      return database
        .createDatabase(dbname)
        .then(() => debug(`Now ${dbname} database exists`));

      // ---------------------------------------------------------------------
      // Use that database, then check that all the collections exist
    })
    .then(async () => {
      database.useDatabase(dbname);
      return database.listCollections();
    })
    .then(
      (dbcols) =>
        Promise.each(colnames, (c) => {
          if (dbcols.find((d) => d.name === c)) {
            return debug(`Collection ${c} exists`);
          }

          return database
            .collection(c)
            .create()
            .then(() => debug(`Collection ${c} has been created`));
        })

      // ---------------------------------------------------------------------
      // Now check if the proper indexes exist on each collection:
    )
    .then(() => indexes)
    .map(async (ind) => database.collection(ind.collection).indexes())
    .map((dbindexes, index_) => {
      // Dbindexes looks like [ { fields: [ 'token' ], sparse: true, unique: true },... ]
      const index = indexes[index_]; // { collection: 'tokens', index: 'index' }
      const hasindex = dbindexes.find(
        (index_) =>
          index_.fields.includes(index.index) && index_.sparse && index_.unique
      );
      if (hasindex)
        return debug(
          `Index ${index.index} exists on collection ${index.collection}`
        );
      return database
        .collection(index.collection)
        .createHashIndex(index.index, { unique: true, sparse: true })
        .then(() =>
          debug(`Created ${index.index} index on ${index.collection}`)
        );

      // ----------------------------------------------------------------------
      // Finally, insert default users if they want some:
    })
    .then(() => defaultusers || [])
    .map(async (u) =>
      database
        .collection('users')
        .firstExample({ username: u.username })
        .then(() => debug(`User ${u.username} exists.`))
        .catch(async () => {
          debug(`saving user ${u}`);
          return database
            .collection('users')
            .save(u)
            .then(() => debug(`Created user ${u.username}`));
        })
    );
};
