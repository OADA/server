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

var debug = require('debug')('model-user');

var config = require('../../config');
var path = require('path');
var db = require(path.join(__dirname,'/../../db',config.get('auth:datastoresDriver'),'users.js'));

function makeUser(user) {
  // No model needed (yet)
  return user;
}

function findByUsername(id, cb) {
  db.findByUsername(id, function(err, u) {
    if (err) { debug(err); }
    var user;
    if (!err) {
      user = makeUser(u);
    }

    cb(err, user);
  });
}

function findByUsernamePassword(username, password, cb) {
  db.findByUsernamePassword(username, password, function(err, u) {
    if (u) { debug(u); }

    var user;
    if (!err) {
      user = makeUser(u);
    }

    cb(err, user);
  });
}

function findByOIDCToken(idtoken, cb) {
  db.findByOIDCToken(idtoken, function(err, u) {
    debug('findByOIDCToken: searched for idtoken sub=',idtoken.sub,', iss=',idtoken.iss,', found u = ', u,', err = ', err);
    var user = err ? makeUser(u) : null;
    cb(err, user);
  });
}

module.exports = {
  findByUsername: findByUsername,
  findByUsernamePassword: findByUsernamePassword,
  findByOIDCToken: findByOIDCToken,
};
