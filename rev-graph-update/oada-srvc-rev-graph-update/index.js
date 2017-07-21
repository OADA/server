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
const trace = debug('rev-graph-update:trace');
const info = debug('rev-graph-update:info');
const error = debug('rev-graph-update:error');

const Promise = require('bluebird');
// const kf = require('kafka-node');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
			config.get('kafka:topics:writeRequest'),
			config.get('kafka:topics:httpResponse'),
			config.get('kafka:groupId'));

module.exports = function stopResp() {
	return responder.disconnect(); 
};

responder.on('request', function handleReq(req, msg) {
	if (!req || req.msgtype !== 'write-response') {
		trace('Received message, but msgtype is not write-response to ignoring message');
		return []; // not a write-response message, ignore it
	}
	if (req.code !== 'success') {
		trace('Received write response message, but code was not "success" so ignoring message');
		return [];
	}
	if(typeof req.resource_id === "undefined" ||
		 typeof req._rev === "undefined" ) {
		throw new Error(`Invalid http_response: there is either no resource_id or _rev.  respose = ${JSON.stringify(req)}`);
	}
	if (typeof req.doc.user_id === "undefined") {
		trace('WARNING: received message does not have user_id');
	}
	if (typeof req.authorizationid === "undefined") {
		trace('WARNING: received message does not have authorizationid');
	}

	// setup the write_request msg
	const write_request_msgs = [];
	const res = {
		type: 'write_request',
		resource_id: null,
		path: null,
		connection_id: req.connection_id,
		contentType: null,
		body: null,
		url: "",
		user_id: req.doc.user_id,
		authorizationid: req.doc.authorizationid
	};

	trace('find parents for resource_id = ', req.resource_id);

	// find resource's parent
	return oadaLib.resources.getParents(req.resource_id)
		.then(p => {
			if (!p) {
					info('WARNING: resource_id'+req.resource_id+' does not have a parent.');
					return res;
			}

			let length = p.length;
			let i = 0;

			trace('the parents are: ', p);
		
			return Promise.map(p, item => {
					trace('parent resource_id = ', item.resource_id);
					let msg = Object.assign({}, res);
					msg.resource_id = item.resource_id;
					msg.path_leftover = item.path + '/_rev';
					msg.contentType = item.contentType;
					msg.body = req._rev;

					trace('trying to produce: ', msg);

					return msg;
			});
	})
	.catch(err => {
		error(err);
	});
});

