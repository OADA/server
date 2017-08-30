/* Copyright 2017 Open Ag Data Alliance
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

const debug = require('debug');
const trace = debug('shares:trace');
const info = debug('shares:info');
const error = debug('shares:error');

const Promise = require('bluebird');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
			config.get('kafka:topics:httpResponse'),
			config.get('kafka:topics:writeRequest'),
			'shares');

module.exports = function stopResp() {
  return responder.disconnect(); 
};

responder.on('request', function handleReq(req) {
  if (req.msgtype !== 'write-response') return
  if (req.code !== 'success') return
  if (req.path_leftover.indexOf('_meta/_permissions/users') === -1) return
  //get user's /shares and add this
  return oadaLib.resources.getResource(req.resource_id).then((res) => {
    return Promise.map(Object.keys(res._meta._changes[res._rev].merge._meta._permissions.users), (id) => {
			trace('Change made on user: '+id)
			return oadaLib.users.findById(id).then((user) => {
				trace('making a write request to /shares for user - '+id)
				return {
					'resource_id': user.shares._id,
					'path_leftover': '',
//					'meta_id': req['meta_id'],
          'user_id': user._id,
//				 'authorizationid': req.user.doc['authorizationid'],
//          'client_id': req.user.doc['client_id'],
          'content_type': 'application/vnd.oada.permission.1+json',
			    'body': {[req.resource_id.split('/')[1]]: {_id: req.resource_id}},
        } 
      })
    })
  })
})
