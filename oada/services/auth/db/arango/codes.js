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
const trace = require('debug')('arango:codes:trace');

const oadaLib = require('@oada/lib-arangodb');

function findByCode(code, cb) {
  trace('findByCode: searching for code ', code);
  return Bluebird.resolve(oadaLib.codes.findByCode(code))
    .then((c) => c && Object.assign(c, { id: c._id, _id: undefined }))
    .then((c) => {
      if (c && c.user) {
        Object.assign(c.user, { id: c.user._id, _id: undefined });
      }

      return c;
    })
    .asCallback(cb);
}

function save(in_code, cb) {
  const code = cloneDeep(in_code);
  Object.assign(code, { _id: code.id, id: undefined });
  // Link user
  code.user = { _id: null };
  if (in_code.user) {
    code.user = { _id: in_code.user.id };
  }

  return Bluebird.resolve(oadaLib.codes.save(code)).asCallback(cb);
}

module.exports = {
  findByCode: findByCode,
  save: save,
};
