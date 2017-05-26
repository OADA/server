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

var config = require('../../config');
var oadaLib = require('../../../../libs/oada-lib-arangodb');
var trace = require('debug')('arango:user/trace');

function findById(id, cb) {
  trace('findById: searching for user ',id);
  oadaLib.users.findById(id).asCallback(cb);
}

function findByUsername(username, cb) {
  trace('findByUsername: searching for user ',username);
  oadaLib.users.findByUsername(username).asCallback(cb);
}

function findByUsernamePassword(username, password, cb) {
  trace('findByUsername: searching for user ',username, ' with a password');
  oadaLib.users.findByUsernamePassword(username, password).asCallback(cb);
}

module.exports = {
  findById: findById,
  findByUsernamePassword: findByUsernamePassword,
  findByUsername: findByUsername,
};
