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

import { Database } from 'arangojs';
import bcrypt from 'bcryptjs';
import debug from 'debug';

import type { User } from '@oada/models/user';
import { config } from '../../config.js';

const log = debug('arango/init');

const roundsOrSalt =
  config.get('bcrypt.saltRounds') || config.get('bcrypt.salt');

// ------------------------------------------------------------
// First setup some shorter variable names:
const systemDatabase = new Database(config.get('arangodb.connectionString'));
const databaseName = config.get('arangodb.database');
const cols = config.get('arangodb.collections');
const colnames = Object.values(cols);
// Get users, hash passwords in case we need to save:
const usersFile = config.get('arangodb.init.defaultData.users');
const defaultUsers = (usersFile ? await import(usersFile) : {}) as Record<
  string,
  User
>;
for await (const user of Object.values(defaultUsers)) {
  const { password } = user;
  if (password) {
    user.password = await bcrypt.hash(password, roundsOrSalt);
  }
}

const indexes = [
  { collection: 'users', index: 'username' },
  { collection: 'clients', index: 'clientId' },
  { collection: 'tokens', index: 'token' },
  { collection: 'codes', index: 'code' },
] as const;

// Allow oada-ref-auth-js to pass us the config, avoiding circular requires
async function init() {
  log('Checking for db setup');

  // ---------------------------------------------------------------------
  // Start the show: Figure out if the database exists: if not, make it
  await systemDatabase.get();
  const dbs = await systemDatabase.listDatabases();
  if (dbs.includes(databaseName)) {
    log('Database %s exists', databaseName);
  } else {
    log('Database %s does not exist. Creating.', databaseName);
    await systemDatabase.createDatabase(databaseName);
    log('Now %s database exists', databaseName);
  }

  // ---------------------------------------------------------------------
  // Use that database, then check that all the collections exist
  const database = systemDatabase.database(databaseName);
  const databaseCols = await database.listCollections();
  for await (const c of colnames) {
    if (databaseCols.some(({ name }) => name === c.name)) {
      log('Collection %s exists', c);
      continue;
    }

    await systemDatabase.collection(c.name).create();
    log('Collection %s has been created', c);
  }

  // ---------------------------------------------------------------------
  // Now ensure the proper indexes exist on each collection:
  for await (const { index, collection } of indexes) {
    log('Ensuring %s index on %s', index, collection);
    const col = database.collection(collection);
    await col.ensureIndex({
      type: 'persistent',
      name: collection,
      fields: [index],
      sparse: true,
      unique: true,
    });
  }

  // ----------------------------------------------------------------------
  // Finally, insert default users if they want some:
  const users = systemDatabase.collection('users');
  for await (const user of Object.values(defaultUsers)) {
    try {
      await users.firstExample({ username: user.username });
      log('User % s exists', user.username);
    } catch {
      log(user, 'Saving user');
      await users.save(user);
      log('Created user %s', user.username);
    }
  }
}

export default init;
