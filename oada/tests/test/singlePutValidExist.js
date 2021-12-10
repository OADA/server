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
  Testing script 5:
    - The scenario for one single PUT with valid token + valid URL (referring to
  an existing resource).
 */

describe('PUT (Valid Token with Valid URL of an Existing Res)', () => {
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
    `${debugMark}Starting tests... (for ${path.win32.basename(__filename)})`
  );
  const VALID_TOKEN = 'xyz';

  const tokenToUse = VALID_TOKEN;
  const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss';
  const url = `http://proxy${VALID_GET_REQ_URL}`;

  // --------------------------------------------------
  // Task - HTTP response
  // --------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  let http_get_response_before = null;
  let http_get_error_response_before = null;
  let picked_up_intial = null;
  let http_put_response = null;
  let http_put_error_response = null;
  let http_get_response_after = null;
  let http_get_error_response_after = null;

  before((done) => {
    // Embed the token for all HTTP request.
    const axiosInst = axios.create({
      headers: {
        Authorization: `Bearer ${tokenToUse}`,
      },
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP
      .then(() =>
        axiosInst
          .get(url)
          .then((response) => {
            trace(`${debugMark}Before PUT`);
            trace(`HTTP GET Response: ${response}`);
            http_get_response_before = response;
            picked_up_intial = http_get_response_before.data.picked_up;
          })
          .catch((error) => {
            info(`HTTP GET Error: ${error}`);
            if (error.response) {
              info('data: ', error.response.data);
              info('status: ', error.response.status);
              info('headers: ', error.response.headers);
              http_get_error_response_before = error.response;
            }
          })
      )
      .then(() =>
        axiosInst
          .put(
            url,
            {
              picked_up: !picked_up_intial,
            },
            {
              headers: {
                'Content-Type': 'application/vnd.oada.rock.1+json',
              },
            }
          )
          .then((response) => {
            trace(`HTTP PUT Response: ${response}`);
            http_put_response = response;
          })
          .catch((error) => {
            info(`HTTP Put Error: ${error}`);
            if (error.response) {
              info('data: ', error.response.data);
              info('status: ', error.response.status);
              info('headers: ', error.response.headers);
              http_put_error_response = error.response;
            }
          })
      )
      .then(() =>
        axiosInst
          .get(url)
          .then((response) => {
            trace(`${debugMark}After PUT`);
            trace(`HTTP GET Response: ${response}`);
            http_get_response_after = response;
            done();
          })
          .catch((error) => {
            info(`HTTP GET Error: ${error}`);
            if (error.response) {
              info('data: ', error.response.data);
              info('status: ', error.response.status);
              info('headers: ', error.response.headers);
              http_get_error_response_after = error.response;
            }

            done();
          })
      )
      .catch((error_) => error(error_));
  });

  // Tests.
  describe('Task: HTTP responses for the PUT request', () => {
    describe('http_get_error_response_before', () => {
      it('should be null', () => {
        trace(
          `http_get_error_response_before: ${http_get_error_response_before}`
        );
        expect(http_get_error_response_before).to.be.null;
      });
    });

    describe('http_get_response_before', () => {
      it('should be a non-empty object', () => {
        trace(`http_get_response_before: ${http_get_response_before}`);
        expect(http_get_response_before).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace(
          `http_get_response_before.status: ${http_get_response_before.status}`
        );
        expect(http_get_response_before)
          .to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_response_before.data', () => {
      it('should be a non-empty object', () => {
        trace(
          `http_get_response_before.data: ${http_get_response_before.data}`
        );
        expect(http_get_response_before.data).to.be.an('Object').that.is.not
          .empty;
      });
      it('should contain the field picked_up', () => {
        trace(
          `http_get_response_before.data.picked_up: ${http_get_response_before.data.picked_up}`
        );
        expect(http_get_response_before.data)
          .to.have.property('picked_up')
          .that.is.a('Boolean');
      });
    });

    describe('http_put_error_response', () => {
      it('should be null', () => {
        trace(`http_put_error_response: ${http_put_error_response}`);
        expect(http_put_error_response).to.be.null;
      });
    });

    describe('http_put_response', () => {
      it('should be a non-empty object', () => {
        trace(`http_put_response: ${http_put_response}`);
        expect(http_put_response).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 204 No Content', () => {
        trace(`http_put_response.status: ${http_put_response.status}`);
        expect(http_put_response).to.have.property('status').that.equals(204);
      });
    });

    describe('http_get_error_response_after', () => {
      it('should be null', () => {
        trace(
          `http_get_error_response_after: ${http_get_error_response_after}`
        );
        expect(http_get_error_response_after).to.be.null;
      });
    });

    describe('http_get_response_after', () => {
      it('should be a non-empty object', () => {
        trace(`http_get_response_after: ${http_get_response_after}`);
        expect(http_get_response_after).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace(
          `http_get_response_after.status: ${http_get_response_after.status}`
        );
        expect(http_get_response_after)
          .to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_response_after.data', () => {
      it('should be a non-empty object', () => {
        trace(`http_get_response_after.data: ${http_get_response_after.data}`);
        expect(http_get_response_after.data).to.be.an('Object').that.is.not
          .empty;
      });
      it('should contain the updated picked_up', () => {
        trace(
          `http_get_response_after.data.picked_up: ${http_get_response_after.data.picked_up}`
        );
        expect(http_get_response_after.data)
          .to.have.property('picked_up')
          .that.is.a('Boolean')
          .that.equals(!picked_up_intial);
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
