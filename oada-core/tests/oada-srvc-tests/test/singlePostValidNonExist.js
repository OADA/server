'use strict'

/*
  Testing script 6 - 2:
    - The scenario for one single POST with valid token + valid URL (referring
    to a non-existing rock resource).
 */

describe('Create a Non-Existing Res Using POST', () => {

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

  const uuidV4 = require('uuid/v4');

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
  const VALID_TOKEN = 'xyz';

  const tokenToUse = VALID_TOKEN;
  // Use uuid to generate the id to make sure the resource is not already there.
  let id_to_use = 'default:resources_rock_' + uuidV4();
  let url = 'http://proxy/resources/default:resources_rock_' + id_to_use;

  // Use a random Boolean value to create the resource.
  let picked_up_to_set = Math.random() >= 0.5;
  //--------------------------------------------------
  // Task - HTTP response
  //--------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  let http_get_response_before = null,
    http_get_error_response_before = null,
    http_create_response = null,
    http_create_error_response = null,
    http_get_response_after = null,
    http_get_error_response_after = null;

  let location_assigned = null,
    rand_id_assigned = null;

  before((done) => {
    // Embed the token for all HTTP request.
    let axiosInst = axios.create({
      headers: {
        'Authorization': `Bearer ${tokenToUse}`
      }
    });

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      return axiosInst.get(url)
        .then(function(response) {
          trace(debugMark + 'Before creating the resource...');
          trace('HTTP GET Response: ' + response);
          http_get_response_before = response;
        })
        .catch(function(error) {
          info('HTTP GET Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_get_error_response_before = error.response;
          }
        });
    }).then(() => {
      return axiosInst.post(url, {
          'picked_up': picked_up_to_set
        }, {
          'headers': {
            'Content-Type': 'application/vnd.oada.rock.1+json'
          }
        }).then(function(response) {
          trace('HTTP create Response: ' + response);
          http_create_response = response;
          location_assigned = response.headers.location;
          trace('HTTP create Response location_assigned: ' +
            location_assigned);
          rand_id_assigned = /\/([\w-]+)$/.exec(location_assigned);
          rand_id_assigned = rand_id_assigned[1];
          trace('HTTP create Response rand_id_assigned: ' +
            rand_id_assigned);
        })
        .catch(function(error) {
          info('HTTP Put Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_create_error_response = error.response;
          }
        });
    }).then(() => {
      return axiosInst.get(url)
        .then(function(response) {
          trace(debugMark + 'After creating the resource...');
          trace('HTTP GET Response: ' + response);
          http_get_response_after = response;
          done();
        })
        .catch(function(error) {
          info('HTTP GET Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_get_error_response_after = error.response;
          }
          done();
        });
    }).catch(err => error(err));
  })

  // Tests.
  describe('Task: HTTP responses for the POST request', () => {
    describe('http_get_response_before', () => {
      it('should be null', () => {
        trace("http_get_response_before:" + http_get_response_before);
        expect(http_get_response_before).to.be.null;
      });
    });

    describe('http_get_error_response_before', () => {
      it('should be a non-empty object', () => {
        trace("http_get_error_response_before:" + http_get_error_response_before);
        expect(http_get_error_response_before).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 403 Forbidden', () => {
        trace("http_get_error_response_before.status:" + http_get_error_response_before.code);
        expect(http_get_error_response_before).to.have.property('status')
          .that.equals(403);
      });
    });

    describe('http_create_error_response', () => {
      it('should be null', () => {
        trace("http_create_error_response: " +
          http_create_error_response);
        expect(http_create_error_response).to.be.null;
      });
    });

    describe('http_create_response', () => {
      it('should be a non-empty object', () => {
        trace("http_create_response: " + http_create_response);
        expect(http_create_response).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 204 No Content', () => {
        trace("http_create_response.status: " +
          http_create_response.status);
        expect(http_create_response).to.have.property('status')
          .that.equals(204);
      });
    });

    describe('http_create_response.headers', () => {
      it('should be a non-empty object', () => {
        trace("http_create_response.headers: " +
          http_create_response.headers);
        expect(http_create_response.headers).to.be.an('Object')
          .that.is.not.empty;
      });
      it('should contain a non-empty location field (indicating the assigned random id)',
        () => {
          trace("http_create_response.headers.location: " +
            http_create_response.headers.location);
          expect(http_create_response.headers).to.have.property('location')
            .that.is.not.empty;
        });
    });

    describe('http_get_error_response_after', () => {
      it('should be null', () => {
        trace("http_get_error_response_after: " +
          http_get_error_response_after);
        expect(http_get_error_response_after).to.be.null;
      });
    });

    describe('http_get_response_after', () => {
      it('should be a non-empty object', () => {
        trace("http_get_response_after: " + http_get_response_after);
        expect(http_get_response_after).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace("http_get_response_after.status: " +
          http_get_response_after.status);
        expect(http_get_response_after).to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_response_after.data', () => {
      it('should be a non-empty object', () => {
        trace("http_get_response_after.data: " +
          http_get_response_after.data);
        expect(http_get_response_after.data).to.be.an('Object')
          .that.is.not.empty;
      });
      it('should contain one field referred to by rand_id_assigned', () => {
        trace("http_get_response_after.data.[rand_id_assigned]: " +
          http_get_response_after.data[rand_id_assigned]);
        expect(http_get_response_after.data).to.have.property(rand_id_assigned)
          .that.is.a('Object').that.is.not.empty;
      });
    });

    describe('http_get_response_after.data[rand_id_assigned]', () => {
      it('should contain the correct picked_up value', () => {
        trace("http_get_response_after.data[rand_id_assigned].picked_up: " +
          http_get_response_after.data[rand_id_assigned].picked_up);
        expect(http_get_response_after.data[rand_id_assigned])
          .to.have.property('picked_up')
          .that.is.a('Boolean').that.equals(picked_up_to_set);
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