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
const trace = debug('websockets:trace');
const info = debug('websockets:info');
const error = debug('websockets:error');

const Promise = require('bluebird');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');
const EventEmitter = require('events')
const emitter = new EventEmitter(); 

//---------------------------------------------------------
// Websockets Server 
const WebSocket = require('ws');
 
const wss = new WebSocket.Server();
 
wss.on('connection', function connection(ws) {

	ws.on('message', function incoming(message) {
		let watchListener = function(content) {
			ws.send(JSON.stringify(content))
		}
		let msg = json.parse(content))
		switch(msg.method) {
			//TODO: CURRENTLY WATCH IS ONLY method implemented
		case get: 
			break
		case put:
			break
		case post:
			break
		case watch:
			emitter.on(msg.resource_id, watchListener(msg.))
			break
		default: 
			//Error
		}
		ws.on('close', function closing() {
			emitter.removeListener(msg.resource_id, watchListener)
		})
	});
});

//---------------------------------------------------------
// Kafka intializations:

const resources = {}

const writeResponder = new Responder(
	config.get('kafka:topics:httpResponse'),
	null,
	'websockets');

module.exports = function stopResp() {
	return responder.disconnect(); 
};

// Listen for successful write requests to resources of interest, then emit an event
writeResponder.on('request', function handleReq(req) {
	if (req.msgtype !== 'write-response') return
	if (req.code !== 'success') return
	trace('REQ', req)
	oadaLib.resources.getResource(req.resource_id).then((res) => {
		emitter.emit(req.resource_id, res._meta._changes[res._rev])
	})
})

.on('request', function handleWrite(req, data, respond) {
	trace('STARTING UP A WEBSOCKET LISTENER ON ', req.resource_id);

})


