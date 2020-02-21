'use strict'

/*
  Testing script 2 - 2:
    - The scenario for one single GET request with valid token + valid URL
    (referring to an existing resource but a non-existing field).
 */

describe('GET (Valid Token with Valid URL referring to Non-Existing field)', () => {
  const config = require('../config')
  // config.set('isTest', true);
  const path = require('path')

  const debug = require('debug')
  const trace = debug('tests:trace')
  const info = debug('tests:info')
  const error = debug('tests:error')
  const debugMark = ' => '

  const expect = require('chai').expect
  const axios = require('axios')
  const Promise = require('bluebird')
  const validator = require('validator')

  // To test the token lookup, we need a dummy data base. Note that isTest has
  // been set to true in package.json so that oadalib will populate the database
  // according to exmpledocs for us.
  const oadaLib = require('oada-lib-arangodb')
  // // Also get the dummy data that will be get for comparison.
  // const expectedObject = require('oada-lib-arangodb/libs/exampledocs/resources');
  // Used to create the database and populate it with the default testing data.
  let setDatabaseP = oadaLib.init.run().catch(err => {
    error(err)
  })

  // Real tests.
  info(
    debugMark +
      'Starting tests... (for ' +
      path.win32.basename(__filename) +
      ')'
  )
  const VALID_TOKEN = 'xyz'

  const tokenToUse = VALID_TOKEN
  const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss'
  let url = 'http://proxy' + VALID_GET_REQ_URL + '/non-existing-field'

  //--------------------------------------------------
  // Task - HTTP response
  //--------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding HTTP
  // response message.
  let http_get_response = null,
    http_get_error_response = null

  before(done => {
    const token = tokenToUse

    // Embed the token for all HTTP request.
    let axiosInst = axios.create({
      headers: {
        Authorization: `Bearer ${token}`
      }
    })

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      axiosInst
        .get(url)
        .then(function (response) {
          trace('HTTP GET Response: ' + response)
          http_get_response = response
          done()
        })
        .catch(function (error) {
          info('HTTP GET Error: ' + error)
          if (error.response) {
            info('data: ', error.response.data)
            info('status: ', error.response.status)
            info('headers: ', error.response.headers)
            http_get_error_response = error.response
          }
          done()
        })
    })
  })

  // Tests.
  describe('Task: HTTP response for the GET request', () => {
    describe('http_get_response', () => {
      it('should be null', () => {
        trace('http_get_response:' + http_get_response)
        expect(http_get_response).to.be.null
      })
    })

    describe('http_get_error_response', () => {
      it('should be a non-empty object', () => {
        trace('http_get_error_response:' + http_get_error_response)
        expect(http_get_error_response).to.be.an('Object').that.is.not.empty
      })
      it('should contain the status 404 Not Found', () => {
        trace('http_get_error_response.status:' + http_get_error_response.code)
        expect(http_get_error_response)
          .to.have.property('status')
          .that.equals(404)
      })
    })
  })

  after(() => {
    info(debugMark + 'in after()')
    info('    config = ' + config)
    info('    config.isTest = ' + config.get('isTest'))
    return oadaLib.init.cleanup().catch(err => {
      error(err)
    })
  })
})
