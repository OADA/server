'use strict'

/*
  Testing script 8:
    - The scenario for one single PUT with valid token + valid URL to create a
    rocks-index resource referring to an existing rock resource.
 */

describe('Create a Rocks-Index Res for an Existing Rock Res Using PUT', () => {

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

  // Use uuid to generate the id for the rocks res to make sure the resource is
  // not already there.
  let id_to_use = 'resources/' + uuidV4();
  let url = 'http://proxy/' + id_to_use;
  info('URL for the resource to be added: ' + url);

  let VALID_ROCK_ID = 'resources/default:resources_rock_123';
  let REF_ROCK_URL = 'http://proxy/' + VALID_ROCK_ID;
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

  let resultedRocksIdx = null;

  let http_get_ref_rock_res = null,
    http_get_ref_rock_err = null;
  let http_get_indexed_rock_res = null,
    http_get_indexed_rock_err = null;

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
      return axiosInst.put(url, {
          'rocks-index': {
            '123': {
              '_id': VALID_ROCK_ID
            }
          }
        }, {
          'headers': {
            'Content-Type': 'application/vnd.oada.rocks.1+json'
          }
        }).then(function(response) {
          trace('HTTP create Response: ' + response);
          http_create_response = response;
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
          resultedRocksIdx = response.data['rocks-index'];
        })
        .catch(function(error) {
          info('HTTP GET Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_get_error_response_after = error.response;
          }
        });
    }).then(() => {
      // GET the indexed rock.
      return axiosInst.get(url + '/rocks-index/123')
        .then(function(response) {
          trace('HTTP GET Indexed Rock Response: ' + response);
          http_get_indexed_rock_res = response;
        })
        .catch(function(error) {
          info('HTTP GET Indexed Rock Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_get_indexed_rock_err = error.response;
          }
        });
    }).then(() => {
      // Also GET the rock for comparison.
      return axiosInst.get(REF_ROCK_URL)
        .then(function(response) {
          trace('HTTP GET Ref Rock Response: ' + response);
          http_get_ref_rock_res = response;
          done();
        })
        .catch(function(error) {
          info('HTTP GET Ref Rock Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_get_ref_rock_err = error.response;
          }
          done();
        });
    }).catch(err => error(err));
  })

  // Tests.
  describe('Task: HTTP responses for the PUT request', () => {
    // Before creating the resource.
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

    // Creating the resource.
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

    // After creating the resource - 1: Index rock.
    describe('http_get_indexed_rock_res', () => {
      it('should be a non-empty object', () => {
        trace("http_get_indexed_rock_res: " + http_get_indexed_rock_res);
        expect(http_get_indexed_rock_res).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace("http_get_indexed_rock_res.status: " +
          http_get_indexed_rock_res.status);
        expect(http_get_indexed_rock_res).to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_indexed_rock_err', () => {
      it('should be null', () => {
        trace("http_get_indexed_rock_err: " +
          http_get_indexed_rock_err);
        expect(http_get_indexed_rock_err).to.be.null;
      });
    });

    // After creating the resource - 2: Ref rock.
    describe('http_get_ref_rock_res', () => {
      it('should be a non-empty object', () => {
        trace("http_get_ref_rock_res: " + http_get_ref_rock_res);
        expect(http_get_ref_rock_res).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace("http_get_ref_rock_res.status: " +
          http_get_ref_rock_res.status);
        expect(http_get_ref_rock_res).to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_ref_rock_res.data', () => {
      it('should be a non-empty object', () => {
        trace("http_get_ref_rock_res.data: " + http_get_ref_rock_res.data);
        expect(http_get_ref_rock_res.data).to.be.an('Object').that.is.not.empty;
      });
    });

    describe('http_get_ref_rock_err', () => {
      it('should be null', () => {
        trace("http_get_ref_rock_err: " +
          http_get_ref_rock_err);
        expect(http_get_ref_rock_err).to.be.null;
      });
    });

    // After creating the resource - 1: Created resource.
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
      it('should contain a valid rocks-index field', () => {
        trace("http_get_response_after.data['rocks-index']: " +
          http_get_response_after.data['rocks-index']);
        expect(http_get_response_after.data)
          .to.have.property('rocks-index').that.is.an('Object')
          .that.has.property('123').that.is.an('Object')
          .that.has.property('_id').that.equals(VALID_ROCK_ID);
      });
    });

    describe('The rock resource indexed by the new resource', () => {
      it('should be deep equal to the original rock resource', () => {
        expect(http_get_indexed_rock_res.data)
          .to.be.deep.equal(http_get_ref_rock_res.data);
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