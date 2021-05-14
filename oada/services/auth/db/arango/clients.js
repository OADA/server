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

const debug = require('debug')('arango:client:trace');
const Bluebird = require('bluebird');

const oadaLib = require('@oada/lib-arangodb');

async function findById(id, cb) {
  debug('retrieving client { clientId: "' + id + '" }');
  const client = await oadaLib.clients.findById(id);
  client && Object.assign(client, { id: client._id, _id: undefined });
  await Bluebird.resolve(client).asCallback(cb);
}

async function save(client, cb) {
  Object.assign(client, { _id: client.id, id: undefined });
  debug('saving clientId ', client.clientId);
  const c = await oadaLib.clients.save(client);
  await Bluebird.resolve(c).asCallback(cb);
}

module.exports = {
  findById: findById,
  save: save,
};
