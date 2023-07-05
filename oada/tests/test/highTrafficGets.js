/**
 * @license
 * Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

/*
  Testing script 10:
    - The scenario for parallel GET requests with valid token + valid URL.
 */

describe('High-Traffic GETs (Valid Token with Valid URL)', function () {
  const config = require('../config');
  // Config.set('isTest', true);
  const path = require('path');

  const debug = require('debug');
  const trace = debug('tests:trace');
  const info = debug('tests:info');
  const error = debug('tests:error');
  const debugMark = ' => ';

  const { expect } = require('chai');
  const axios = require('axios');
  const Promise = require('bluebird');

  // To test the token lookup, we need a dummy data base. Note that isTest has
  // been set to true in package.json so that oadalib will populate the database
  // according to exmpledocs for us.
  const oadaLib = require('@oada/lib-arangodb');
  // // Also get the dummy data that will be get for comparison.
  // const expectedObject = require('@oada/lib-arangodb/libs/exampledocs/resources');
  // Used to create the database and populate it with the default testing data.
  const setDatabaseP = oadaLib.init.run().catch((error_) => {
    error(error_);
  });

  // Real tests.
  info(
    `${debugMark}Starting tests... (for ${path.win32.basename(__filename)})`,
  );
  const VALID_TOKEN = 'xyz'; // 'KwGmHSxxAWsgJlXEHDmN2Rn1yemKA_awmEzUoPZW';

  const tokenToUse = VALID_TOKEN;
  const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss';
  const url = `http://proxy${VALID_GET_REQ_URL}`; // 'https://hendrix.api.farmhack.nl/bookmarks/farmhack/hendrix/data';

  // --------------------------------------------------
  // Task - HTTP response
  // --------------------------------------------------
  // Use concurrency to mimic multiple clients, each make multiple GET
  // requests.
  const NUM_OF_CLIENTS = 100;
  const NUM_OF_GETS_EACH = 10;
  const TIMEOUT = 60_000; // ~100
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message. We will record all the responses.
  const numberOfGetsTotal = NUM_OF_CLIENTS * NUM_OF_GETS_EACH;
  const http_get_responses = Array.from({ length: numberOfGetsTotal });
  const http_get_error_responses = Array.from({ length: numberOfGetsTotal });

  this.timeout(TIMEOUT);
  before((done) => {
    // Embed the token for all HTTP request.
    const axiosInst = axios.create({
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
      },
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      Promise.map(
        Array.from({ length: numberOfGetsTotal }),
        () =>
          axiosInst
            .get(url)
            .then((response) => {
              trace(`HTTP GET Response: ${response}`);
              http_get_responses.push(response);
            })
            .catch((error) => {
              info(`HTTP GET Error: ${error}`);
              if (error.response) {
                info('data: ', error.response.data);
                info('status: ', error.response.status);
                info('headers: ', error.response.headers);
                http_get_error_responses.push(error.response);
              }
            }),
        {
          concurrency: NUM_OF_CLIENTS,
        },
      ).asCallback(done);
    });
  });

  // Tests.
  describe('Task: HTTP responses for the GET requests', () => {
    describe('each http_get_error_response', () => {
      it('should be null', () => {
        for (const http_get_error_response of http_get_error_responses) {
          trace(`http_get_error_response: ${http_get_error_response}`);
          expect(http_get_error_response).to.be.null;
        }
      });
    });

    describe('each http_get_response', () => {
      it('should be a non-empty object', () => {
        for (const http_get_response of http_get_responses) {
          trace(`http_get_response: ${http_get_response}`);
          expect(http_get_response).to.be.an('Object').that.is.not.empty;
        }
      });
      it('should contain the status 200 OK', () => {
        for (const http_get_response of http_get_responses) {
          trace(`http_get_response.status: ${http_get_response.status}`);
          expect(http_get_response).to.have.property('status').that.equals(200);
        }
      });
    });

    describe('http_get_response.data', () => {
      it('should be a non-empty object', () => {
        for (const http_get_response of http_get_responses) {
          trace(`http_get_response.data: ${http_get_response.data}`);
          expect(http_get_response.data).to.be.an('Object').that.is.not.empty;
        }
      });
      it('should contain the correct _id', () => {
        for (const http_get_response of http_get_responses) {
          trace(`http_get_response.data._id: ${http_get_response.data._id}`);
          expect(http_get_response.data)
            .to.have.property('_id')
            .that.is.a('String')
            .that.equals('resources/default:resources_rock_123');
        }
      });
      it('should contain the correct location', () => {
        for (const http_get_response of http_get_responses) {
          trace(
            `http_get_response.data.location: ${http_get_response.data.location}`,
          );
          expect(http_get_response.data)
            .to.have.property('location')
            .that.is.an('Object')
            .that.deep.equals({
              latitude: '-40.1231242',
              longitude: '82.192089123',
            });
        }
      });
    });
  });

  after(() => {
    info(`${debugMark}in after()`);
    info(`    config = ${config}`);
    info(`    config.isTest = ${config.get('isTest')}`);
    return oadaLib.init.cleanup().catch((error_) => {
      error(error_);
    });
  });
});
