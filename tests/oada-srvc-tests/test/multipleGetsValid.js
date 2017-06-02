'use strict'

/*
  Testing script 3:
    - The scenario for multiple GET requests with valid token + valid URL.
    - We will HTTP GET all resources listed in our dummy data base one by one.
 */

describe('GETs (Valid Token with Valid URLs)', () => {
  const config = require('../config');
  // config.set('isTest', true);
  const path = require('path');

  const debug = require('debug');
  const trace = debug('tests:trace');
  const info = debug('tests:info');
  const error = debug('tests:error');
  const debugMark = " => ";

  const expect = require('chai').expect;
  const axios = require('axios');
  const Promise = require('bluebird');
  const validator = require('validator');

  // To test the token lookup, we need a dummy data base. Note that isTest has
  // been set to true in package.json so that oadalib will populate the database
  // according to exmpledocs for us.
  const oadaLib = require('../../../libs/oada-lib-arangodb');
  // Also get the dummy data that will be get for comparison.
  const oriResources = require('../../../libs/oada-lib-arangodb/libs/exampledocs/resources');
  info(debugMark + 'Original resources has been loaded.');
  trace(debugMark + 'oriResources:');
  trace(oriResources);
  // Used to create the database and populate it with the default testing data.
  let setDatabaseP = oadaLib.init.run()
    .catch(err => {
      error(err);
    });

  // Real tests.
  info(debugMark + 'Starting tests... (for ' +
    path.win32.basename(__filename) + ')');
  const VALID_TOKEN = 'xyz';
  const tokenToUse = VALID_TOKEN;

  // Conctruct the list of valid URLs according to oriResources.
  trace(debugMark + 'VALID_GET_REQ_URLS:');
  const VALID_GET_REQ_URLS = oriResources.map((obj) => {
    let url = '/' + obj._id + '/';
    trace(url);
    return url;
  });
  let urls = VALID_GET_REQ_URLS.map((reqUrl) => ('http://proxy' + reqUrl));
  trace(debugMark + 'urls:');
  urls.forEach((url) => trace(url));
  // Construct results to compare. First, get rid of fields that may change / not
  // required in the response.
  const FIELDS_TO_DELETE = ['_key', '_oada_rev'];
  let expectedObjects = oriResources.map((obj) => {
    FIELDS_TO_DELETE.forEach((field) => {
      delete obj[field];
    });
    return obj;
  });
  // For _meta, only keep the _id field.
  expectedObjects = expectedObjects.map((obj) => {
    let meta = {
      _id: obj._meta._id
    };
    obj._meta = meta;
    return obj;
  });

  //--------------------------------------------------
  // Task - HTTP response
  //--------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  let http_get_responses = new Array(urls.length).fill(null),
    http_get_error_responses = new Array(urls.length).fill(null);

  before((done) => {
    const token = tokenToUse;

    // Embed the token for all HTTP request.
    let axiosInst = axios.create({
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      Promise.each(urls, (url, idx) => {
        return axiosInst.get(url)
          .then(function(response) {
            trace('HTTP GET Response: ' + response);
            http_get_responses[idx] = response;
          })
          .catch(function(error) {
            info('HTTP GET Error: ' + error);
            if (error.response) {
              info('data: ', error.response.data);
              info('status: ', error.response.status);
              info('headers: ', error.response.headers);
              http_get_error_responses[idx] = error.response;
            }
          });
      }).asCallback(done);
    });

  });

  // Tests.
  describe('Task: HTTP responses for the GET requests', () => {
    before(() => {
      info(debugMark + 'All HTTP GET requests are finished.');
      trace(debugMark + 'http_get_responses');
      trace(http_get_responses);
      trace(debugMark + 'http_get_error_responses');
      trace(http_get_error_responses);
    });

    it('should generate tests after the HTTP requests', () => {
      for (let idx = 0; idx < urls.length; idx++) {
        let http_get_error_response = http_get_error_responses[idx],
          http_get_response = http_get_responses[idx],
          expectedObject = expectedObjects[idx];

        describe('URL #' + (idx + 1) + ': ' + urls[idx],
          () => {
            describe('http_get_error_response #' + idx, () => {
              it('should be null', () => {
                trace("http_get_error_response: " + http_get_error_response);
                expect(http_get_error_response).to.be.null;
              });
            });

            describe('http_get_response #' + idx, () => {
              it('should be a non-empty object', () => {
                trace("http_get_response: " + http_get_response);
                expect(http_get_response).to.be.an('Object').that.is.not.empty;
              });
              it('should contain the status 200 OK', () => {
                trace("http_get_response.status: " + http_get_response.status);
                expect(http_get_response).to.have.property('status')
                  .that.equals(200);
              });
            });

            describe('The field "data" of http_get_response #' + idx,
              () => {
                it('should be a non-empty object', () => {
                  trace("http_get_response.data: " + http_get_response.data);
                  expect(http_get_response.data).to.be.an('Object').that.is.not.empty;
                });
                it('should have fields that agree with the original resources',
                  () => {
                    let keys = [];
                    for (let key in expectedObject) {
                      if (expectedObject.hasOwnProperty(key)) {
                        keys.push(key);
                      }
                    }
                    keys.forEach((key) => {
                      if (key == '_meta') {
                        it('should contain a non-empty _meta field', () => {
                          trace("http_get_response.data." + key + ": " + http_get_response.data[key]);
                          expect(http_get_response.data).to.have.property(key)
                            .that.is.not.empty;
                        });
                        // For the _meta field, only need to check the _meta._id.
                        it('should contain the correct _id in ' + key, () => {
                          trace("http_get_response.data." + key + "._id: " +
                            http_get_response.data[key]['_id']);
                          expect(http_get_response.data).to.have.property('_id')
                            .that.equals(expectedObject[key][_id]);
                        });
                      } else {
                        it('should contain the correct ' + key, () => {
                          trace("http_get_response.data." + key + ": " + http_get_response.data[key]);
                          expect(http_get_response.data).to.have.property(key)
                            .that.equals(expectedObject[key]);
                        });
                      }
                    })
                  });
              });
          });
      }
    });

  });
  after(() => {
    info(debugMark + "in after()")
    info("    config = " + config);
    info("    config.isTest = " + config.get("isTest"));
    return oadaLib.init.cleanup().catch(err => {
      error(err)
    });
  });
});