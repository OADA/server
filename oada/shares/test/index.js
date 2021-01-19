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
const randomstring = require('randomstring');
const kf = require('@oada/lib-kafka');
const oadaLib = require('@oada/lib-arangodb');
const config = require('../config');
const debug = require('debug');
const trace = debug('trace:shares#test');
const shares = require('../');
const axios = require('axios');

const requester = new kf.Requester(
  config.get('kafka:topics:writeRequest'),
  config.get('kafka:topics:httpResponse'),
  config.get('kafka:groupId') + '-test'
);

describe('shares service', () => {
  before(oadaLib.init.run);
  before(function waitKafka(done) {
    requester.on('ready', () => done());
  });

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------
  describe('.shares', () => {
    it('should produce a write request', (done) => {
      /*
			return axios({
				url: 'https://vip3.ecn.purdue.edu/bookmarks/rocks/rocks-index/90j2klfdjss/_meta/_permissions',
				headers: {
          'Authorization': 'Bearer xyz',
					'Content-Type': 'application/vnd.trellisfw.client'
				},
		    data: {
					[`users/default:user_sam_321`]: {
            read: true,
            write: true,
            owner: false
          }
        }
			})
			*/
      // make http_response message
      let r = {
        msgtype: 'write-response',
        code: 'success',
        resource_id: '/resources:default:resources_rock_123',
        path_leftover: '/_meta/_permissions',
        connection_id: '123abc' + randomstring.generate(7),
        _rev: randomstring.generate(7),
        doc: {
          user_id: 'franko123' + randomstring.generate(7),
        },
        authorizationid: 'tuco123' + randomstring.generate(7),
      };

      console.log('http_response message is: ', r);

      // now produce the message:
      // create the listener:

      requester.send(r).then((msg) => {
        trace('received message: ', msg);
        expect(msg.type).to.equal('write_request');
        expect(msg.path_leftover).to.equal('/rocks-index/90j2klfdjss/_rev');
        expect(msg.resource_id).to.equal(
          'resources/default:resources_rocks_123'
        );
        expect(msg.contentType).to.equal('application/vnd.oada.rocks.1+json');
        expect(msg.user_id).to.equal(r.doc.user_id);
        expect(msg.authorizationid).to.equal(r.doc.authorizationid);
        expect(msg.body).to.equal(r._rev);
        expect(msg.connection_id).to.equal(r.connection_id);
        expect(msg.url).to.equal('');

        done();
      });
    }).timeout(10000);
  });

  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(oadaLib.init.cleanup);
  after(function rdis() {
    this.timeout(10000);
    requester.disconnect();
  });
  after(function revDis() {
    this.timeout(10000);
    revGraphUpdate();
  });
});
