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
  Testing script 3:
    - The scenario for multiple GET requests with valid token + valid URL.
    - We will HTTP GET all resources listed in our dummy data base one by one.
 */

describe('GETs (Valid Token with Valid URLs)', () => {
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
  // Also get the dummy data that will be get for comparison.
  const oriResources = require('@oada/lib-arangodb/libs/exampledocs/resources');
  info(`${debugMark}Original resources has been loaded.`);
  trace(`${debugMark}oriResources:`);
  trace(oriResources);
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

  // Conctruct the list of valid URLs according to oriResources.
  trace(`${debugMark}VALID_GET_REQ_URLS:`);
  const VALID_GET_REQ_URLS = oriResources.map((object) => {
    const url = `/${object._id}/`;
    trace(url);
    return url;
  });
  const urls = VALID_GET_REQ_URLS.map(
    (requestUrl) => `http://proxy${requestUrl}`
  );
  trace(`${debugMark}urls:`);
  for (const url of urls) trace(url);
  // Construct results to compare. First, get rid of fields that may change / not
  // required in the response.
  const FIELDS_TO_DELETE = ['_key', '_oada_rev'];
  let expectedObjects = oriResources.map((object) => {
    for (const field of FIELDS_TO_DELETE) {
      delete object[field];
    }

    return object;
  });
  // For _meta, only keep the _id field.
  expectedObjects = expectedObjects.map((object) => {
    const meta = {
      _id: object._meta._id,
    };
    object._meta = meta;
    return object;
  });

  // --------------------------------------------------
  // Task - HTTP response
  // --------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  const http_get_responses = new Array(urls.length).fill(null);
  const http_get_error_responses = new Array(urls.length).fill(null);

  before((done) => {
    const token = tokenToUse;

    // Embed the token for all HTTP request.
    const axiosInst = axios.create({
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      Promise.each(urls, (url, index) =>
        axiosInst
          .get(url)
          .then((response) => {
            trace(`HTTP GET Response: ${response}`);
            http_get_responses[index] = response;
          })
          .catch((error) => {
            info(`HTTP GET Error: ${error}`);
            if (error.response) {
              info('data: ', error.response.data);
              info('status: ', error.response.status);
              info('headers: ', error.response.headers);
              http_get_error_responses[index] = error.response;
            }
          })
      ).asCallback(done);
    });
  });

  // Tests.
  describe('Task: HTTP responses for the GET requests', () => {
    before(() => {
      info(`${debugMark}All HTTP GET requests are finished.`);
      trace(`${debugMark}http_get_responses`);
      trace(http_get_responses);
      trace(`${debugMark}http_get_error_responses`);
      trace(http_get_error_responses);
    });

    it('should generate tests after the HTTP requests', () => {
      for (const [index, url] of urls.entries()) {
        const http_get_error_response = http_get_error_responses[index];
        const http_get_response = http_get_responses[index];
        const expectedObject = expectedObjects[index];

        describe(`URL #${index + 1}: ${url}`, () => {
          describe(`http_get_error_response #${index}`, () => {
            it('should be null', () => {
              trace(`http_get_error_response: ${http_get_error_response}`);
              expect(http_get_error_response).to.be.null;
            });
          });

          describe(`http_get_response #${index}`, () => {
            it('should be a non-empty object', () => {
              trace(`http_get_response: ${http_get_response}`);
              expect(http_get_response).to.be.an('Object').that.is.not.empty;
            });
            it('should contain the status 200 OK', () => {
              trace(`http_get_response.status: ${http_get_response.status}`);
              expect(http_get_response)
                .to.have.property('status')
                .that.equals(200);
            });
          });

          describe(`The field "data" of http_get_response #${index}`, () => {
            it('should be a non-empty object', () => {
              trace(`http_get_response.data: ${http_get_response.data}`);
              expect(http_get_response.data).to.be.an('Object').that.is.not
                .empty;
            });
            it('should have fields that agree with the original resources', () => {
              const keys = [];
              for (const key in expectedObject) {
                if (expectedObject.hasOwnProperty(key)) {
                  keys.push(key);
                }
              }

              for (const key of keys) {
                if (key == '_meta') {
                  it('should contain a non-empty _meta field', () => {
                    trace(
                      `http_get_response.data.${key}: ${http_get_response.data[key]}`
                    );
                    expect(http_get_response.data).to.have.property(key).that.is
                      .not.empty;
                  });
                  // For the _meta field, only need to check the _meta._id.
                  it(`should contain the correct _id in ${key}`, () => {
                    trace(
                      `http_get_response.data.${key}._id: ${http_get_response.data[key]._id}`
                    );
                    expect(http_get_response.data)
                      .to.have.property('_id')
                      .that.equals(expectedObject[key][_id]);
                  });
                } else {
                  it(`should contain the correct ${key}`, () => {
                    trace(
                      `http_get_response.data.${key}: ${http_get_response.data[key]}`
                    );
                    expect(http_get_response.data)
                      .to.have.property(key)
                      .that.equals(expectedObject[key]);
                  });
                }
              }
            });
          });
        });
      }
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
