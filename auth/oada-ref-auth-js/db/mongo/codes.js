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

var db = require('./mongo.js');
var users = require('../models/user');

function findByCode(code, cb) {
  db.codes.findOne({code: code}, function(err, code) {
    if (err) { return cb(err); }

    if (code) {
      // Rename mongo's _id
      code.id = code._id;

      // Populate user
      users.findById(code.user._id, function(err, user) {
        if (err) { return cb(err); }

        code.user = user;

        cb(null, code);
      });
    } else {
      cb(null);
    }
  });
}

function save(code, cb) {
  // Link user
  code.user = {_id: code.user._id};

  db.codes.save(code, function(err) {
    if (err) { return cb(err); }

    findByCode(code.code, cb);
  });
}

module.exports = {
  findByCode: findByCode,
  save: save,
};
