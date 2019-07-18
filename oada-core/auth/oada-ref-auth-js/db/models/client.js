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

var uuid = require('uuid');

var config = require('../../config');
var debug = require('debug')('info');
var path = require('path');
var db = require(path.join(__dirname,'/../../db',config.get('auth:datastoresDriver'),'clients.js'));

function makeClient(client) {
  // No model needed (yet)
  return client;
}

function findById(id, cb) {
  db.findById(id, function(err, c) {
    var client;
    if (!err) {
      client = makeClient(c);
    }

    cb(err, client);
  });
}

function save(client, cb) {
  client.clientId = uuid.v4();

  db.findById(client.clientId, function(err, c) {
    if (err) { debug(err); return cb(err); }

    if (c) {
      return cb(new OADAError('Client Id already exists',
                              OADAError.codes.BAD_REQUEST,
                              'There was a problem durring the login'));
    }

    db.save(client, function(err) {
      if (err) { debug(err); return cb(err); }

      findById(client.clientId, cb);
    });
  });
}

module.exports = {
  findById: findById,
  save: save
};
