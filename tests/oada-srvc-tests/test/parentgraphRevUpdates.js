'use strict'

/*
  Testing script 9:
    - Check whether _rev updates for a link when the linked res updates.
 */

describe('Check Rev Update for a Link Res (Parent Graph)', () => {

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
  info('URL for the link to be added: ' + url);

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

  let resultedRockId = null,
    resultedRev = null;

  let http_get_ref_rock_res = null,
    http_get_ref_rock_err = null;
  let http_linked_rock_res = null,
    http_linked_rock_err = null;

  // For updating the linked rock and check the _rev field of the link.
  let picked_up_intial = null;
  let http_update_rock_res = null,
    http_update_rock_err = null;
  let http_get_updated_rock_res = null,
    http_get_updated_rock_err = null;
  let MAX_NUM_TRAILS = 1000,
    TIME_TO_SLEEP_BETWEEN_TRIALS = 100; // In milliseconds
  let http_get_response_final = null,
    http_get_error_final = null;

  before((done) => {
    // Embed the token for all HTTP request.
    let axiosInst = axios.create({
      headers: {
        'Authorization': `Bearer ${tokenToUse}`
      }
    });

    // Synchronous sleep.
    function sleep(milliseconds) {
      var start = new Date().getTime();
      for (var i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds){
          break;
        }
      }
    }
    // Try getting the link res (at least once) with numOfTrials.
    function getUpdatedLinkRes(numOfTrials, timeToSleep) {
      info(debugMark + 'getUpdatedLinkRes numTrials = ' + numOfTrials + ' ...');
      return axiosInst.get(url)
        .then(function(response) {
          trace('HTTP GET Response: ' + response);
          trace('        data.rock: ' +
            JSON.stringify(response.data.rock, null, 2))

          http_get_response_final = response;

          let flagRevMatched = (http_get_response_final.data.rock._rev ==
            http_get_updated_rock_res.data._rev);
          info('  _rev comparison result: ' +
            (flagRevMatched ? 'Matched!' : 'Not matched...'));
          trace('  flagRevMatched: ' + flagRevMatched);
          if (flagRevMatched) {
            return response;
          } else {
            info('- Current    _rev: ' + response.data.rock._rev);
            info('+ Expected   _rev: ' + http_get_updated_rock_res.data._rev);
            sleep(timeToSleep);
            if (numOfTrials <= 1) {
              return Promise.reject(Error('Exceed maximum number of trials!'));
            } else {
              return getUpdatedLinkRes(--numOfTrials, timeToSleep)
            }
          }
        })
        .catch(function(error) {
          trace('HTTP GET Error: ' + error);
          if (error.response) {
            trace('data: ', error.response.data);
            trace('status: ', error.response.status);
            trace('headers: ', error.response.headers);
            http_get_error_final = error.response;
          }
        });
    };

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
          'rock': {
            '_id': VALID_ROCK_ID,
            '_rev': '0-0'
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
          trace('HTTP Put Error: ' + error);
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
          info(debugMark + 'After creating the resource...');
          trace('HTTP GET Response: ' + response);
          http_get_response_after = response;
          resultedRockId = response.data.rock._id;
          resultedRev = response.data.rock._rev;
        })
        .catch(function(error) {
          trace('HTTP GET Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_get_error_response_after = error.response;
          }
        });
    }).then(() => {
      // GET the linked rock.
      return axiosInst.get(url + '/rock')
        .then(function(response) {
          trace('HTTP GET Linked Rock Response: ' + response);
          http_linked_rock_res = response;
        })
        .catch(function(error) {
          info('HTTP GET Linked Rock Error: ' + error);
          if (error.response) {
            info('data: ', error.response.data);
            info('status: ', error.response.status);
            info('headers: ', error.response.headers);
            http_linked_rock_err = error.response;
          }
        });
    }).then(() => {
      // Also GET the rock for comparison.
      return axiosInst.get(REF_ROCK_URL)
        .then(function(response) {
          info('HTTP GET Ref Rock Response: ' + response);
          http_get_ref_rock_res = response;
          picked_up_intial = response.data.picked_up;
        })
        .catch(function(error) {
          info('HTTP GET Ref Rock Error: ' + error);
          if (error.response) {
            trace('data: ', error.response.data);
            trace('status: ', error.response.status);
            trace('headers: ', error.response.headers);
            http_get_ref_rock_err = error.response;
          }
        });
    }).then(() => {
      // Update the linked rock.
      return axiosInst.put(REF_ROCK_URL, {
          'picked_up': !picked_up_intial
        }, {
          'headers': {
            'Content-Type': 'application/vnd.oada.rock.1+json'
          }
        }).then(function(response) {
          info('HTTP PUT Response: ' + response);
          http_update_rock_res = response;
        })
        .catch(function(error) {
          info('HTTP Put Error: ' + error);
          if (error.response) {
            trace('data: ', error.response.data);
            trace('status: ', error.response.status);
            trace('headers: ', error.response.headers);
            http_update_rock_err = error.response;
          }
        });
    }).then(() => {
      // Get the updated rock.
      return axiosInst.get(REF_ROCK_URL)
        .then(function(response) {
          info('HTTP GET Updated Rock Response: ' + response);
          http_get_updated_rock_res = response;
        })
        .catch(function(error) {
          info('HTTP GET Updated Rock Error: ' + error);
          if (error.response) {
            trace('data: ', error.response.data);
            trace('status: ', error.response.status);
            trace('headers: ', error.response.headers);
            http_get_updated_rock_err = error.response;
          }
        });
    }).then(() => {
      // Get the link resource to check the _rev. We will try at most
      // MAX_NUM_TRAILS times, because it may take some time for the _rev in the
      // link res to be updated.
      return getUpdatedLinkRes(MAX_NUM_TRAILS, TIME_TO_SLEEP_BETWEEN_TRIALS);
    }).asCallback(done).catch(err => error(err));
  })

  // Tests.
  describe('Task: HTTP responses for the PUT request', () => {
    // Before the updates.
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

    describe('http_linked_rock_res', () => {
      it('should be a non-empty object', () => {
        trace("http_linked_rock_res: " + http_linked_rock_res);
        expect(http_linked_rock_res).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace("http_linked_rock_res.status: " +
          http_linked_rock_res.status);
        expect(http_linked_rock_res).to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_linked_rock_err', () => {
      it('should be null', () => {
        trace("http_linked_rock_err: " +
          http_linked_rock_err);
        expect(http_linked_rock_err).to.be.null;
      });
    });

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
      it('should contain a non-empty _rev field', () => {
        trace("http_get_ref_rock_res.data._rev: " +
          http_get_ref_rock_res.data._rev);
        expect(http_get_ref_rock_res.data).to.have.property('_rev')
          .that.is.a('String').that.is.not.empty;
      });
    });

    describe('http_get_ref_rock_err', () => {
      it('should be null', () => {
        trace("http_get_ref_rock_err: " +
          http_get_ref_rock_err);
        expect(http_get_ref_rock_err).to.be.null;
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
      it('should contain a non-empty rock field', () => {
        trace("http_get_response_after.data.picked_up: " +
          http_get_response_after.data.picked_up);
        expect(http_get_response_after.data).to.have.property('rock')
          .that.is.an('Object').that.is.not.empty;
      });
    });

    describe('http_get_response_after.data.rock', () => {
      it('should be a non-empty object', () => {
        trace("http_get_response_after.data: " +
          http_get_response_after.data);
        expect(http_get_response_after.data).to.be.an('Object')
          .that.is.not.empty;
      });
      it('should contain the correct _id field', () => {
        trace("http_get_response_after.data.rock._id: " +
          http_get_response_after.data.rock._id);
        expect(http_get_response_after.data.rock).to.have.property('_id')
          .that.is.a('String').that.equals(VALID_ROCK_ID);
      });
      it('should contain the correct _rev field', () => {
        trace("http_get_response_after.data.rock._rev: " +
          http_get_response_after.data.rock._rev);
        expect(http_get_response_after.data.rock).to.have.property('_rev')
          .that.is.a('String').that.equals(http_get_ref_rock_res.data._rev);
      });
    });

    describe('The rock resource refered to by the link', () => {
      it('should be deep equal to the original rock resource', () => {
        expect(http_linked_rock_res.data)
          .to.be.deep.equal(http_get_ref_rock_res.data);
      });
    });

    // After the updates.
    describe('http_update_rock_err', () => {
      it('should be null', () => {
        trace("http_update_rock_err: " +
          http_update_rock_err);
        expect(http_update_rock_err).to.be.null;
      });
    });

    describe('http_update_rock_res', () => {
      it('should be a non-empty object', () => {
        trace("http_update_rock_res: " + http_update_rock_res);
        expect(http_update_rock_res).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 204 No Content', () => {
        trace("http_update_rock_res.status: " +
          http_update_rock_res.status);
        expect(http_update_rock_res).to.have.property('status')
          .that.equals(204);
      });
    });

    describe('http_get_updated_rock_res', () => {
      it('should be a non-empty object', () => {
        trace("http_get_updated_rock_res: " + http_get_updated_rock_res);
        expect(http_get_updated_rock_res).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace("http_get_updated_rock_res.status: " +
          http_get_updated_rock_res.status);
        expect(http_get_updated_rock_res).to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_updated_rock_res.data', () => {
      it('should be a non-empty object', () => {
        trace("http_get_updated_rock_res.data: " + http_get_updated_rock_res.data);
        expect(http_get_updated_rock_res.data).to.be.an('Object').that.is.not.empty;
      });
      it('should contain a non-empty _rev field', () => {
        trace("http_get_updated_rock_res.data._rev: " +
          http_get_updated_rock_res.data._rev);
        expect(http_get_updated_rock_res.data).to.have.property('_rev')
          .that.is.a('String').that.is.not.empty;
      });
    });

    describe('http_get_updated_rock_err', () => {
      it('should be null', () => {
        trace("http_get_updated_rock_err: " +
          http_get_updated_rock_err);
        expect(http_get_updated_rock_err).to.be.null;
      });
    });

    describe('http_get_error_final', () => {
      it('should be null', () => {
        trace("http_get_error_final: " +
          http_get_error_final);
        expect(http_get_error_final).to.be.null;
      });
    });

    describe('http_get_response_final', () => {
      it('should be a non-empty object', () => {
        trace("http_get_response_final: " + http_get_response_final);
        expect(http_get_response_final).to.be.an('Object').that.is.not.empty;
      });
      it('should contain the status 200 OK', () => {
        trace("http_get_response_final.status: " +
          http_get_response_final.status);
        expect(http_get_response_final).to.have.property('status')
          .that.equals(200);
      });
    });

    describe('http_get_response_final.data', () => {
      it('should be a non-empty object', () => {
        trace("http_get_response_final.data: " +
          http_get_response_final.data);
        expect(http_get_response_final.data).to.be.an('Object')
          .that.is.not.empty;
      });
      it('should contain a non-empty rock field', () => {
        trace("http_get_response_final.data.picked_up: " +
          http_get_response_final.data.picked_up);
        expect(http_get_response_final.data).to.have.property('rock')
          .that.is.an('Object').that.is.not.empty;
      });
    });

    describe('http_get_response_final.data.rock', () => {
      it('should be a non-empty object', () => {
        trace("http_get_response_final.data: " +
          http_get_response_final.data);
        expect(http_get_response_final.data).to.be.an('Object')
          .that.is.not.empty;
      });
      it('should contain the correct _id field', () => {
        trace("http_get_response_final.data.rock._id: " +
          http_get_response_final.data.rock._id);
        expect(http_get_response_final.data.rock).to.have.property('_id')
          .that.is.a('String').that.equals(VALID_ROCK_ID);
      });
      it('should contain the correct _rev field', () => {
        trace("http_get_response_final.data.rock._rev: " +
          http_get_response_final.data.rock._rev);
        expect(http_get_response_final.data.rock).to.have.property('_rev')
          .that.is.a('String').that.equals(http_get_updated_rock_res.data._rev);
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