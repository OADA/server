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

var bcrypt = require('bcryptjs');

const config = require('../../config');
const { users } = require('oada-lib-arangodb');
const trace = require('debug')('arango:user:trace');

function findById(id, cb) {
  trace('findById: searching for user ', id);
  return (
    users
      .findById(id)
      // Why replace the _id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(cb)
  );
}

function findByUsername(username, cb) {
  trace('findByUsername: searching for user ', username);
  return (
    users
      .findByUsername(username)
      // Why replace the _id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(cb)
  );
}

function findByUsernamePassword(username, password, cb) {
  trace('findByUsername: searching for user ', username, ' with a password');
  return (
    users
      .findByUsernamePassword(username, password)
      // Why replace the_id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(cb)
  );
}

function findByOIDCToken(idtoken, cb) {
  trace(
    'findByOIDCToken: searching for oidc token sub=',
    idtoken.sub,
    ', iss=',
    idtoken.iss
  );
  return (
    users
      .findByOIDCToken(idtoken)
      // Why replace the_id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(cb)
  );
}

function findByOIDCUsername(username, domain, cb) {
  trace(
    'findByOIDCUsername: searching for oidc username',
    username,
    'at ',
    domain
  );
  return (
    users
      .findByOIDCUsername(username, domain)
      // Why replace the_id?
      //    .then(u => u && Object.assign(u, {id: u._id, _id: undefined}))
      .asCallback(cb)
  );
}

function update(user, cb) {
  let u = Object.assign({}, user, { _id: user.id, id: undefined });
  return users.update(u).asCallback(cb);
}

module.exports = {
  findById: findById,
  findByUsernamePassword: findByUsernamePassword,
  findByUsername: findByUsername,
  findByOIDCToken: findByOIDCToken,
  findByOIDCUsername,
  update,
};
