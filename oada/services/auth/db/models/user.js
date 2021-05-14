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
const db = require(// nosemgrep: detect-non-literal-require
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

function findById(id, cb) {
  return Bluebird.fromCallback((done) => db.findById(id, done))
    .then((u) => makeUser(u))
    .tapCatch(debug)
    .asCallback(cb);
}

function findByUsername(id, cb) {
  return Bluebird.fromCallback((done) => db.findByUsername(id, done))
    .then((u) => makeUser(u))
    .tapCatch(debug)
    .asCallback(cb);
}

function findByUsernamePassword(username, password, cb) {
  return Bluebird.fromCallback((done) => {
    return db.findByUsernamePassword(username, password, done);
  })
    .tap(debug)
    .then((u) => makeUser(u))
    .asCallback(cb);
}

function findByOIDCToken(idtoken, cb) {
  return Bluebird.fromCallback((done) => db.findByOIDCToken(idtoken, done))
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
    .asCallback(cb);
}

function findByOIDCUsername(username, iss, cb) {
  return Bluebird.fromCallback((done) =>
    db.findByOIDCUsername(username, iss, done)
  )
    .then((u) => makeUser(u))
    .asCallback(cb);
}

function update(user, cb) {
  return Bluebird.fromCallback((done) => db.update(user, done)).asCallback(cb);
}

module.exports = {
  findById: findById,
  findByUsername: findByUsername,
  findByUsernamePassword: findByUsernamePassword,
  findByOIDCToken: findByOIDCToken,
  findByOIDCUsername,
  update,
};
