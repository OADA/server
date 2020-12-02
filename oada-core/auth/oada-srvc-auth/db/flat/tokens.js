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

var _ = require('lodash')
var tokens = require('./tokens.json')

function findByToken (token, cb) {
  cb(null, _.cloneDeep(tokens[token]))
}

function save (token, cb) {
  tokens[token.token] = JSON.parse(JSON.stringify(token))

  findByToken(token.token, cb)
}

module.exports = {
  findByToken: findByToken,
  save: save
}
