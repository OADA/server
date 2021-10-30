/* Copyright 2014 Open Ag Data Alliance
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

'use strict';

const Bluebird = require('bluebird');
const debug = require('debug')('model-user');

const config = require('../../config');
const path = require('path');
const database = require(// Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
path.join(
  __dirname,
  '/../../db',
  config.get('auth.datastoresDriver'),
  'users.js'
));

function makeUser(user) {
  // No model needed (yet)
  return user;
}

function findById(id, callback) {
  return Bluebird.fromCallback((done) => database.findById(id, done))
    .then((u) => makeUser(u))
    .tapCatch(debug)
    .asCallback(callback);
}

function findByUsername(id, callback) {
  return Bluebird.fromCallback((done) => database.findByUsername(id, done))
    .then((u) => makeUser(u))
    .tapCatch(debug)
    .asCallback(callback);
}

function findByUsernamePassword(username, password, callback) {
  return Bluebird.fromCallback((done) =>
    database.findByUsernamePassword(username, password, done)
  )
    .tap(debug)
    .then((u) => makeUser(u))
    .asCallback(callback);
}

function findByOIDCToken(idtoken, callback) {
  return Bluebird.fromCallback((done) =>
    database.findByOIDCToken(idtoken, done)
  )
    .tap((u) => {
      debug(
        'findByOIDCToken: searched for idtoken sub=',
        idtoken.sub,
        ', iss=',
        idtoken.iss,
        ', found u = ',
        u
      );
    })
    .then((u) => makeUser(u))
    .asCallback(callback);
}

function findByOIDCUsername(username, iss, callback) {
  return Bluebird.fromCallback((done) =>
    database.findByOIDCUsername(username, iss, done)
  )
    .then((u) => makeUser(u))
    .asCallback(callback);
}

function update(user, callback) {
  return Bluebird.fromCallback((done) =>
    database.update(user, done)
  ).asCallback(callback);
}

module.exports = {
  findById,
  findByUsername,
  findByUsernamePassword,
  findByOIDCToken,
  findByOIDCUsername,
  update,
};
