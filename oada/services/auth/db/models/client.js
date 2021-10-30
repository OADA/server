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

'use strict';

const { v4: uuid } = require('uuid');

const OADAError = require('oada-error');
const config = require('../../config');
const debug = require('debug')('info');
const path = require('path');
const database = require(// Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
path.join(
  __dirname,
  '/../../db',
  config.get('auth.datastoresDriver'),
  'clients.js'
));

function makeClient(client) {
  // No model needed (yet)
  return client;
}

function findById(id, callback) {
  database.findById(id, (error, c) => {
    let client;
    if (!error) {
      client = makeClient(c);
    }

    callback(error, client);
  });
}

function save(client, callback) {
  client.clientId = uuid();

  database.findById(client.clientId, (error, c) => {
    if (error) {
      debug(error);
      return callback(error);
    }

    if (c) {
      return callback(
        new OADAError(
          'Client Id already exists',
          OADAError.codes.BAD_REQUEST,
          'There was a problem durring the login'
        )
      );
    }

    database.save(client, (error) => {
      if (error) {
        debug(error);
        return callback(error);
      }

      findById(client.clientId, callback);
    });
  });
}

module.exports = {
  findById,
  save,
};
