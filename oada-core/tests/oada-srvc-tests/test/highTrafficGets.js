'use strict'

/*
  Testing script 10:
    - The scenario for parallel GET requests with valid token + valid URL.
 */

describe('High-Traffic GETs (Valid Token with Valid URL)', function() {

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
  const oadaLib = require('oada-lib-arangodb');
  // // Also get the dummy data that will be get for comparison.
  // const expectedObject = require('oada-lib-arangodb/libs/exampledocs/resources');
  // Used to create the database and populate it with the default testing data.
  let setDatabaseP = oadaLib.init.run()
    .catch(err => {
      error(err);
    });

  // Real tests.
  info(debugMark + 'Starting tests... (for ' +
    path.win32.basename(__filename) + ')');
  const VALID_TOKEN = 'xyz'; // 'KwGmHSxxAWsgJlXEHDmN2Rn1yemKA_awmEzUoPZW';

  const tokenToUse = VALID_TOKEN;
  const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss';
  let url = 'http://proxy' + VALID_GET_REQ_URL; //'https://hendrix.api.farmhack.nl/bookmarks/farmhack/hendrix/data';

  //--------------------------------------------------
  // Task - HTTP response
  //--------------------------------------------------
  // Use concurrency to mimic multiple clients, each make multiple GET
  // requests.
  let NUM_OF_CLIENTS = 100;
  let NUM_OF_GETS_EACH = 10;
  let TIMEOUT = 60000; // ~100
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message. We will record all the responses.
  let numOfGetsTotal = NUM_OF_CLIENTS * NUM_OF_GETS_EACH;
  let http_get_responses = new Array(numOfGetsTotal),
    http_get_error_responses = new Array(numOfGetsTotal);

  this.timeout(TIMEOUT);
  before((done) => {
    // Embed the token for all HTTP request.
    let axiosInst = axios.create({
      headers: {
        'Authorization': `Bearer ${tokenToUse}`
      }
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      Promise.map(
        new Array(numOfGetsTotal),
        () => {
          return axiosInst.get(url)
            .then(function(response) {
              trace('HTTP GET Response: ' + response);
              http_get_responses.push(response);
            })
            .catch(function(error) {
              info('HTTP GET Error: ' + error);
              if (error.response) {
                info('data: ', error.response.data);
                info('status: ', error.response.status);
                info('headers: ', error.response.headers);
                http_get_error_responses.push(error.response);
              }
            });
        }, {
          concurrency: NUM_OF_CLIENTS
        }
      ).asCallback(done);
    });
  });

  // Tests.
  describe('Task: HTTP responses for the GET requests', () => {
    describe('each http_get_error_response', () => {
      it('should be null', () => {
        http_get_error_responses.forEach(
          (http_get_error_response) => {
            trace("http_get_error_response: " + http_get_error_response);
            expect(http_get_error_response).to.be.null;
          }
        )
      });
    });

    describe('each http_get_response', () => {
      it('should be a non-empty object', () => {
        http_get_responses.forEach(
          (http_get_response) => {
            trace("http_get_response: " + http_get_response);
            expect(http_get_response).to.be.an('Object').that.is.not.empty;
          }
        )
      });
      it('should contain the status 200 OK', () => {
        http_get_responses.forEach(
          (http_get_response) => {
            trace("http_get_response.status: " + http_get_response.status);
            expect(http_get_response).to.have.property('status')
              .that.equals(200);
          }
        )
      });
    });

    describe('http_get_response.data', () => {
      it('should be a non-empty object', () => {
        http_get_responses.forEach(
          (http_get_response) => {
            trace("http_get_response.data: " + http_get_response.data);
            expect(http_get_response.data).to.be.an('Object').that.is.not.empty;
          }
        )
      });
      it('should contain the correct _id', () => {
        http_get_responses.forEach(
          (http_get_response) => {
            trace("http_get_response.data._id: " + http_get_response.data._id);
            expect(http_get_response.data).to.have.property('_id')
              .that.is.a('String')
              .that.equals('resources/default:resources_rock_123');
          }
        )
      });
      it('should contain the correct location', () => {
        http_get_responses.forEach(
          (http_get_response) => {
            trace("http_get_response.data.location: " +
              http_get_response.data.location);
            expect(http_get_response.data).to.have.property('location')
              .that.is.an('Object')
              .that.deep.equals({
                "latitude": "-40.1231242",
                "longitude": "82.192089123"
              });
          }
        )
      });
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