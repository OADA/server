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

/* eslint no-console: off, no-process-exit: off -- This is a cli command */

'use strict';

const path = require('path');
const mongojs = require('mongojs');
const bcrypt = require('bcryptjs');
const config = require('../../config');

if (process.argv.length < 3) {
  console.log(
    `Useage: ${process.argv[0]} ${path.basename(
      process.argv[1]
    )} mongoConnectionString ` + `[--no-example-data]`
  );
  process.exit(1);
}

const importData = process.argv[3] !== '--no-example-data';

/// //
// CLIENTS
/// //
const clientsDatabase = mongojs(process.argv[2], ['clients']);

// Create clients indexes
clientsDatabase.clients.ensureIndex(
  { clientId: 1 },
  { unique: true },
  (error) => {
    if (error) {
      console.log(error);
      process.exit();
    }

    // Add example data, unless not requested
    if (importData) {
      // Populate example clients
      const clients = require('../flat/clients.json');
      const mongoClients = Object.keys(clients).map((key) => clients[key]);

      clientsDatabase.clients.insert(mongoClients, (error) => {
        if (error) {
          console.log(error);
        }

        clientsDatabase.close();
      });
    } else {
      clientsDatabase.close();
    }
  }
);

/// //
// USERS
/// //
const usersDatabase = mongojs(process.argv[2], ['users']);

// Create clients indexes
usersDatabase.users.ensureIndex({ username: 1 }, { unique: true }, (error) => {
  if (error) {
    console.log(error);
    process.exit();
  }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    const users = require('../flat/users.json');
    const mongoUsers = Object.keys(users).map((key) => {
      const t = users[key];
      delete t.id;
      t.password = bcrypt.hashSync(t.password, config.server.passwordSalt);

      return t;
    });

    usersDatabase.users.insert(mongoUsers, (error) => {
      if (error) {
        console.log(error);
      }

      usersDatabase.close();
    });
  } else {
    usersDatabase.close();
  }
});

/// //
// CODES
/// //
const codesDatabase = mongojs(process.argv[2], ['codes']);

// Create clients indexes
codesDatabase.codes.ensureIndex({ code: 1 }, { unique: true }, (error) => {
  if (error) {
    console.log(error);
    process.exit();
  }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    const codes = require('../flat/codes.json');
    const mongoCodes = Object.keys(codes).map((key) => {
      const t = codes[key];
      delete t.id;

      return t;
    });

    codesDatabase.codes.insert(mongoCodes, (error) => {
      if (error) {
        console.log(error);
      }

      codesDatabase.close();
    });
  } else {
    codesDatabase.close();
  }
});

/// //
// TOKENS
/// //
const tokensDatabase = mongojs(process.argv[2], ['tokens']);

// Create clients indexes
tokensDatabase.tokens.ensureIndex({ token: 1 }, { unique: true }, (error) => {
  if (error) {
    console.log(error);
    process.exit();
  }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    const tokens = require('../flat/tokens.json');
    const mongoTokens = Object.keys(tokens).map((key) => {
      const t = tokens[key];
      delete t.id;

      return t;
    });

    tokensDatabase.tokens.insert(mongoTokens, (error) => {
      if (error) {
        console.log(error);
      }

      tokensDatabase.close();
    });
  } else {
    tokensDatabase.close();
  }
});
