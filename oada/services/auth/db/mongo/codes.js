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

const database = require('./mongo.js');
const users = require('../models/user');

function findByCode(code, callback) {
  database.codes.findOne({ code }, (error, code) => {
    if (error) {
      return callback(error);
    }

    if (code) {
      // Rename mongo's _id
      code.id = code._id;

      // Populate user
      users.findById(code.user._id, (error, user) => {
        if (error) {
          return callback(error);
        }

        code.user = user;

        callback(null, code);
      });
    } else {
      callback(null);
    }
  });
}

function save(code, callback) {
  // Link user
  code.user = { _id: code.user._id };

  database.codes.save(code, (error) => {
    if (error) {
      return callback(error);
    }

    findByCode(code.code, callback);
  });
}

module.exports = {
  findByCode,
  save,
};
