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
const kf = require('kafka-node');
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');

//---------------------------------------------------------
// Kafka intializations:
const client = new kf.Client(
  config.get('zookeeper:host'),
  config.get('zookeeper:revGraphUpdate')
);
const offset = new kf.Offset(client);
const consumer = new kf.ConsumerGroup({
  host: config.get('zookeeper:host'),
  groupId: 'rev-graph-update',
  fromOffset: 'latest'
}, [config.get('kafka:topics:httpResponse')]);
let producer = new kf.Producer(client, {partitionerType: 0});

process.on('exit', () => {console.log('ere'); client.close()});
process.on('SIGINT', () => {console.log('ere'); client.close(); process.exit(2);});
process.on('uncaughtException', (a) => {console.log('ere', a); client.close(); process.exit(99);});

consumer.on('message', (msg) => {
  return Promise.try(() => {
      return JSON.parse(msg.value);
    })
    .then((req) => {
      if (!req ||
				req.code != 'success' ||
        typeof req.resource_id === "undefined" ||
				typeof req._rev === "undefined" ||
				typeof req.doc.user_id === "undefined" ||
				typeof req.doc.authorizationid === "undefined" ||
				typeof req.connection_id === "undefined" ) {
        throw new Error(`Invalid http_response ${JSON.stringify(req)}`);
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

					for (i = 0; i < length; i++) {
						res.resource_id = p[i].resource_id;
						res.path = p[i].path + '/_rev';
						trace('parent resource_id = ', p[i].resource_id);
						res.contentType = p[i].contentType;
						res.body = req._rev;
						trace('the result msg is: ', res);
						write_request_msgs.splice(i, 0, res);
					}

					return write_request_msgs;
			});
  })
  .then((write_request_msgs) => {
    return Promise.fromCallback((done) => {
			trace('kafka intends to produce: ', write_request_msgs);
			let msgs_str = write_request_msgs.map(msgs => {
				return JSON.stringify(msgs);
			});
			// produce multiple kafka messages
      producer.send([{
        topic: config.get('kafka:topics:writeRequest'),
        messages: msgs_str
      }], done);
    });
  })
  .catch(err => {
    error('%O', err);
  })
  .finally(() =>
    offset.commit('rev-graph-update', [{
      topic: config.get('kafka:topics:httpResponse'),
      partition: msg.partition,
      offset: msg.offset
    }])
  );
});

