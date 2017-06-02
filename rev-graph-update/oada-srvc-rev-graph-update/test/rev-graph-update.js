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
 )* limitations under the License.
 */

'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const Promise = require('bluebird');
const bcrypt = require('bcryptjs');
const randomstring = require("randomstring");
const kf = require('kafka-node');
const oadaLib = require('../../../libs/oada-lib-arangodb');
const config = require('../config');
const debug = require('debug');
const trace = debug('trace:rev-graph-update#test');

// To test the token lookup, have to make a test database and populate it
// with token and user
let db = oadaLib.arango;
let cols = config.get('arango:collections');
let frankid = oadaLib.examples('users')[0]._id;

// kafka topics
const	consTopic = config.get('kafka:topics:writeRequest');
const prodTopic = config.get('kafka:topics:httpResponse');
let client;
let consumer;
let producer;
let groupid;

describe('rev graph update service', () => {
  before((done) => {
		client = new kf.Client("zookeeper:2181", "test-rev_graph_update");

		producer = new kf.Producer(client, {
			partitionerType: 0
    });

		consumer = new kf.ConsumerGroup({
						host: 'zookeeper:2181',
						groupId: 'test-rev_graph_update',
						fromOffset: 'latest'
				}, [
						config.get('kafka:topics:writeRequest')
				]);

		producer.on('ready', () => {console.log('producer ready');});
		consumer.on('connect', done);
  });

  before(oadaLib.init.run);

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------
	describe('.rev-graph-update', () => {
		it('should be able to produce a correct write_request message', (done) => {
			// make http_response message
			let r = {
				code: "success",
				resource_id: '/resources:default:resources_rock_123',
        connection_id: '123abc' + randomstring.generate(7),
				_rev: randomstring.generate(7),
				doc: {
					user_id: 'franko123' + randomstring.generate(7),
					authorizationid: 'tuco123' + randomstring.generate(7)
				}
      };

			console.log('http_response message is: ', r);

      consumer.on('error', err => { throw err } );
      // create the listener:
      consumer.on('message', msg => {
				console.log(msg);
        const wr_msg = JSON.parse(msg.value);

        trace('received message: ', wr_msg);
        expect(wr_msg.type).to.equal('write_request');
				expect(wr_msg.path).to.equal('/rocks-index/90j2klfdjss/_rev');
				expect(wr_msg.resource_id).to.equal('resources/default:resources_rocks_123');
				expect(wr_msg.contentType).to.equal('application/vnd.oada.rocks.1+json');
				expect(wr_msg.user_id).to.equal(r.doc.user_id);
				expect(wr_msg.authorizationid).to.equal(r.doc.authorizationid);
				expect(wr_msg.body).to.equal(r._rev);
				expect(wr_msg.connection_id).to.equal(r.connection_id);
				expect(wr_msg.url).to.equal('');
       
        // the "true" forces commit before close
        consumer.close(true, () => {
          done()
        });
      });

      // now produce the message:
      producer.send([{topic: prodTopic, messages: JSON.stringify(r)}], (a) => {
        console.log('message produced, awaiting response')
      });
    });

		it('should error when http_response msg is not valid', (done) => {
			done();
    });
	});

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(oadaLib.init.cleanup);
});
