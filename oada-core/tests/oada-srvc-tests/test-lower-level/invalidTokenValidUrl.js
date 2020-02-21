'use strict'

/*
  Testing script 1:
    - The scenario for invalid token + valid URL.
 */

const config = require('../config')
// config.set('isTest', true);

const debug = require('debug')
const trace = debug('tests:trace')
const info = debug('tests:info')
const error = debug('tests:error')
const debugMark = ' => '

const expect = require('chai').expect
const axios = require('axios')
const kf = require('kafka-node')
const Promise = require('bluebird')
const validator = require('validator')

// To test the token lookup, we need a dummy data base. Note that isTest has
// been set to true in package.json so that oadalib will populate the database
// according to exmpledocs for us.
const oadaLib = require('oada-lib-arangodb')
// Used to create the database and populate it with the default testing data.
let setDatabaseP = oadaLib.init.run().catch(err => {
  error(err)
})

// Real tests.
info(debugMark + 'Starting tests... (for invalidTokenValidUrl)')
const FOO_INVALID_TOKEN = 'fooInvalidToken-tests'

const tokenToUse = FOO_INVALID_TOKEN
const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss'
let url = 'http://proxy' + VALID_GET_REQ_URL

describe('Invalid Token with Valid URL', () => {
  // Get the Kafka consumers ready.
  const cs_token_req = new kf.ConsumerGroup(
    {
      host: 'zookeeper:2181',
      groupId: 'consume-group-tester-http-handler-token-request',
      protocol: ['roundrobin'],
      fromOffset: 'earliest', // earliest | latest
      sessionTimeout: 15000
    },
    ['token_request']
  )
  const cs_http_res = new kf.ConsumerGroup(
    {
      host: 'zookeeper:2181',
      groupId: 'consume-group-tester-token-lookup-http-response',
      protocol: ['roundrobin'],
      fromOffset: 'earliest', // earliest | latest
      sessionTimeout: 15000
    },
    ['http_response']
  )

  //--------------------------------------------------
  // Task 1 - HTTP-Handler: HTTP response + token_request
  //--------------------------------------------------
  // Hit the server with a URL (and a token) and check corresponding Kafka
  // messages.
  let token_request_str = null,
    token_request = null

  //--------------------------------------------------
  // Task 2 - Token-Lookup:  http-response - token
  //--------------------------------------------------
  // Monitor and check the token message in the http-response.
  let http_response_str = null,
    http_response = null,
    http_response_partition = null,
    doc = null

  before(done => {
    cs_token_req.on('message', msg => {
      // To make sure only one message is consumed.
      cs_token_req.close()

      trace(
        'Kafka cs_token_req message = ' +
          JSON.stringify(msg) +
          ', key = ' +
          msg.key.toString()
      )
      token_request_str = msg.value
      token_request = JSON.parse(token_request_str)
    })

    cs_http_res.on('message', msg => {
      // To make sure only one message is consumed.
      cs_http_res.close()

      trace(
        'Kafka cs_http_res message = ' +
          JSON.stringify(msg) +
          ', key = ' +
          msg.key.toString()
      )
      http_response_str = msg.value
      http_response = JSON.parse(http_response_str)
      http_response_partition = msg.partition
      doc = http_response.doc

      done()
    })

    // Embed the token for all HTTP request.
    axios.interceptors.request.use(
      function (config) {
        const token = tokenToUse // cookie.get(__TOKEN_KEY__);

        if (token != null) {
          config.headers.Authorization = `Bearer ${token}`
        }

        return config
      },
      function (errEmbedToken) {
        return Promise.reject(errEmbedToken)
      }
    )

    // Hit the server when everything is set up correctly.
    setDatabaseP.then(() => {
      axios
        .get(url)
        .then(function (response) {
          trace('HTTP GET Response: ' + response)
        })
        .catch(function (error) {
          info('HTTP GET Error: ' + error)
        })
    })
  })

  // Tests for task 1.
  describe('Task 1: HTTP-Handler', () => {
    describe('token_request Kafka msg', () => {
      it('should be a non-empty string', () => {
        trace('token_request_str:' + token_request_str)
        expect(token_request_str).to.be.a('String').that.is.not.empty
      })
      it('should include the correct token', () => {
        expect(token_request_str).to.contain('token')
        expect(token_request.token).to.equal(`Bearer ${tokenToUse}`)
      })
      it('should have an integer resp_partition', () => {
        expect(token_request_str).to.contain('resp_partition')
        expect(token_request.resp_partition).to.be.a('number')
      })
      it('should have a valid UUID connection id string', () => {
        expect(token_request_str).to.contain('connection_id')
        expect(token_request.connection_id).to.be.a('String')
        expect(validator.isUUID(token_request.connection_id)).to.be.true
      })
    })
  })

  // Tests for task 2.
  describe('Task 2: Token-Lookup', () => {
    describe('http_response_str Kafka msg', () => {
      it('should be a non-empty string', () => {
        expect(http_response_str).to.be.a('String')
        expect(http_response_str).to.not.be.empty
      })
      it('should include the correct token', () => {
        expect(http_response_str).to.contain('token')
        expect(http_response.token).to.equal(`Bearer ${tokenToUse}`)
      })
      it('should indicate the token is invalid', () => {
        expect(http_response).to.have.property('token_exists').that.is.false
      })
      // it('should not repeat resp_partition or partition in the response', () => {
      //   expect(http_response).to.not.have.property('partition');
      //   expect(http_response).to.not.have.property('resp_partition');
      // });
      it('should be from the partition specified by resp_partition', () => {
        expect(http_response_partition).to.equal(token_request.resp_partition)
      })
      it('should have the correct UUID connection id', () => {
        expect(http_response_str).to.contain('connection_id')
        expect(http_response.connection_id).to.equal(
          token_request.connection_id
        )
      })
      it('should have a "doc" field', () => {
        expect(http_response_str).to.contain('doc')
      })
    })

    // More for task 2.
    describe('"doc" from the http_response_str Kafka msg', () => {
      it('should have a null userid', () => {
        expect(doc).to.have.property('userid').that.is.null
      })
      it('should have a null clientid', () => {
        expect(doc).to.have.property('clientid').that.is.null
      })
      it('should have a null bookmarksid', () => {
        expect(doc).to.have.property('bookmarksid').that.is.null
      })
      it('should have an empty scope string', () => {
        // Because the token is invalid, the scope string should be empty.
        expect(doc)
          .to.have.property('scope')
          .that.is.a('String').that.is.empty
      })
    })
  })

  after(() => {
    info('config = ' + config)
    info('config.isTest = ' + config.get('isTest'))
    return oadaLib.init.cleanup()
  })
})
