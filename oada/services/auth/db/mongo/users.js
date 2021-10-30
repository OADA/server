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

const bcrypt = require('bcryptjs');

const config = require('../../config');
const database = require('./mongo.js');

function findByUsername(username, callback) {
  database.users.findOne({ username }, (error, user) => {
    if (error) {
      return callback(error);
    }

    if (user) {
      // Rename mongo's _id
      user.id = user._id;

      callback(null, user);
    } else {
      callback(error, false);
    }
  });
}

function findByUsernamePassword(username, password, callback) {
  const passwd = bcrypt.hashSync(password, config.get('server:passwordSalt'));

  database.users.findOne({ username, password: passwd }, (error, user) => {
    if (error) {
      return callback(error);
    }

    if (user) {
      // Rename mongo's _id
      user.id = user._id;

      callback(null, user);
    } else {
      callback(error, false);
    }
  });
}

module.exports = {
  findById: findByUsername,
  findByUsernamePassword,
};
