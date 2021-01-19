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
'use strict'

var bcrypt = require('bcryptjs')

var config = require('../../config')
var db = require('./mongo.js')

function findByUsername (username, cb) {
  db.users.findOne({ username: username }, function (err, user) {
    if (err) {
      return cb(err)
    }

    if (user) {
      // Rename mongo's _id
      user.id = user._id

      cb(null, user)
    } else {
      cb(err, false)
    }
  })
}

function findByUsernamePassword (username, password, cb) {
  var passwd = bcrypt.hashSync(password, config.get('server:passwordSalt'))

  db.users.findOne({ username: username, password: passwd }, function (
    err,
    user
  ) {
    if (err) {
      return cb(err)
    }

    if (user) {
      // Rename mongo's _id
      user.id = user._id

      cb(null, user)
    } else {
      cb(err, false)
    }
  })
}

module.exports = {
  findById: findByUsername,
  findByUsernamePassword: findByUsernamePassword
}
