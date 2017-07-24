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
const tokenLookup = require('../');
const expect = require('chai').expect;
const Promise = require('bluebird');
const bcrypt = require('bcryptjs');
const randomstring = require("randomstring");
const Requester = require('../../../libs/oada-lib-kafka').Requester;
const oadaLib = require('../../../libs/oada-lib-arangodb');
const config = require('../config');
const debug = require('debug');
const trace = debug('trace:token-lookup#test');

// To test the token lookup, have to make a test database and populate it
// with token and user
let db = oadaLib.arango;
let cols = config.get('arango:collections');
let frankid = oadaLib.examples('users')[0]._id;

const requester = new Requester(config.get('kafka:topics:httpResponse'),
											config.get('kafka:topics:tokenRequest'),
											config.get('kafka:groupId')+'-test');

describe('token lookup service', () => {
  before(oadaLib.init.run);

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------
	describe('.token-lookup', () => {
		it('should be able to perform a token-lookup', (done) => {
			// make token_request message
			let t = {
        resp_partition: 0,
        connection_id: '123abc' + randomstring.generate(7),
        token: 'xyz'
      };

			requester.send(t)
			.then(
				msg => {
					trace('received message: ', msg);
					expect(msg.type).to.equal('http_response')
					expect(msg.token).to.equal('xyz');
					expect(msg.token_exists).is.ok;
					expect(msg.partition).to.equal(0);
					expect(msg.connection_id).to.equal(t.connection_id);
					expect(msg.doc.authorizationid).to.equal(oadaLib.examples('authorizations')[0]._id);
					expect(msg.doc.user_id).to.equal(frankid);
					expect(msg.doc.scope).to.be.instanceof(Array);
					expect(msg.doc.bookmarks_id).to.equal('resources/default:resources_bookmarks_123');
					expect(msg.doc.client_id).to.equal('jf93caauf3uzud7f308faesf3@provider.oada-dev.com');

					done();
      });
    }).timeout(10000);

		it('should error when token does not exist', (done) => {
			let t = {
        resp_partition: 0,
        connection_id: 'abc123',
        token: 'not-valid'
      };

			requester.send(t)
			.then(
				msg => {
					trace('received message: ', msg);
					expect(msg.type).to.equal('http_response')
					expect(msg.token).to.equal(null);
					expect(msg.token_exists).is.not.ok;
					expect(msg.partition).to.equal(0);
					expect(msg.connection_id).to.equal('abc123')
					expect(msg.doc.authorizationid).to.equal(null);
					expect(msg.doc.user_id).to.equal(null);
					expect(msg.doc.scope).to.be.instanceof(Array);
					expect(msg.doc.scope).to.be.empty;
					expect(msg.doc.bookmarks_id).to.equal(null);
					expect(msg.doc.client_id).to.equal(null);

					done();
      });
		}).timeout(10000);
	});

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(oadaLib.init.cleanup);
	after(function reqDis() {
		this.timeout(10000);
		requester.disconnect()
	});
	after(function tokDis() {
		this.timeout(10000);
		tokenLookup();
	});
});
