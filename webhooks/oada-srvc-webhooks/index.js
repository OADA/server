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
const trace = debug('webhooks:trace');
const info = debug('webhooks:info');
const error = debug('webhooks:error');

const Promise = require('bluebird');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
			config.get('kafka:topics:httpResponse'),
			null,
			'webhooks');

module.exports = function stopResp() {
	return responder.disconnect(); 
};

responder.on('request', function handleReq(req) {
	trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
    if (req.msgtype !== 'write-response') return
    if (req.code !== 'success') return
	trace('webhook resource_id : '+req.resource_id)
	return oadaLib.resources.getResource(req.resource_id)
	.get('_meta').get('_syncs').then(Object.values).each((sync) => {
		trace('Sending to: '+sync.url)
		return axios(sync)
	}).then(() => {})
})
