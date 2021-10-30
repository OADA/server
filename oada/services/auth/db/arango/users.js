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
const { users } = require('@oada/lib-arangodb');
const trace = require('debug')('arango:user:trace');

function findById(id, callback) {
  trace('findById: searching for user ', id);
  return (
    Bluebird.resolve(users.findById(id))
      // Why replace the _id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(callback)
  );
}

function findByUsername(username, callback) {
  trace('findByUsername: searching for user ', username);
  return (
    Bluebird.resolve(users.findByUsername(username))
      // Why replace the _id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(callback)
  );
}

function findByUsernamePassword(username, password, callback) {
  trace('findByUsername: searching for user ', username, ' with a password');
  return (
    Bluebird.resolve(users.findByUsernamePassword(username, password))
      // Why replace the_id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(callback)
  );
}

function findByOIDCToken(idtoken, callback) {
  trace(
    'findByOIDCToken: searching for oidc token sub=',
    idtoken.sub,
    ', iss=',
    idtoken.iss
  );
  return (
    Bluebird.resolve(users.findByOIDCToken(idtoken))
      // Why replace the_id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(callback)
  );
}

function findByOIDCUsername(username, domain, callback) {
  trace(
    'findByOIDCUsername: searching for oidc username',
    username,
    'at ',
    domain
  );
  return (
    Bluebird.resolve(users.findByOIDCUsername(username, domain))
      // Why replace the_id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(callback)
  );
}

function update(user, callback) {
  const u = { ...user, _id: user.id, id: undefined };
  return Bluebird.resolve(users.update(u)).asCallback(callback);
}

module.exports = {
  findById,
  findByUsernamePassword,
  findByUsername,
  findByOIDCToken,
  findByOIDCUsername,
  update,
};
