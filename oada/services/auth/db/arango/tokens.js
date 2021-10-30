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

const Bluebird = require('bluebird');
const cloneDeep = require('clone-deep');
const trace = require('debug')('arango:token:trace');
const oadaLib = require('@oada/lib-arangodb');

function findByToken(token, callback) {
  trace('findByToken: searching for token ', token);
  return Bluebird.resolve(oadaLib.authorizations.findByToken(token))
    .then((t) => t && Object.assign(t, { id: t._id, _id: undefined }))
    .then((t) => {
      if (t && t.user) {
        // Why eliminate the _id?
        // Object.assign(t.user, {id: t.user._id, _id: undefined});
      }

      return t;
    })
    .asCallback(callback);
}

function save(token, callback) {
  token = cloneDeep(token);
  Object.assign(token, { _id: token.id, id: undefined });
  // Link user
  token.user = { _id: token.user._id };
  trace('save: saving token ', token);
  return Bluebird.resolve(oadaLib.authorizations.save(token)).asCallback(
    callback
  );
}

module.exports = {
  findByToken,
  save,
};
