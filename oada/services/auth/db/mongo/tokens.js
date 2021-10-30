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

const config = require('../../config');
const users = config.get('datastores:users');

function findByToken(token, callback) {
  database.tokens.findOne({ token }, (error, token) => {
    if (error) {
      return callback(error);
    }

    if (token) {
      token.id = token._id;

      // Populate user
      users.findById(token.user._id, (error, user) => {
        if (error) {
          return callback(error);
        }

        token.user = user;

        callback(null, token);
      });
    } else {
      callback(null);
    }
  });
}

function save(token, callback) {
  // Link user
  token.user = { _id: token.user._id };

  database.tokens.save(token, (error) => {
    if (error) {
      return callback(error);
    }

    findByToken(token.token, callback);
  });
}

module.exports = {
  findByToken,
  save,
};
