'use strict';

/*
  Testing script 0:
    - A simple self test (for express, axios and chai).
 */

const expect = require('chai').expect;
const axios = require('axios');
const Promise = require('bluebird');

// Self test needs the express server. It will verify both axios and chai work
// as expected.
const isSelfTesting = process.env.NODE_ENV === 'selftest';

if (isSelfTesting) {
  const FOO_INVALID_TOKEN = 'foo-invalid-token-tests';

  describe('SelfTest', () => {
    let serverResHeader = '',
      serverResToken = '';

    before(() => {
      // Embed the token for all HTTP request.
      axios.interceptors.request.use(
        function (config) {
          const token = FOO_INVALID_TOKEN; // cookie.get(__TOKEN_KEY__);

          if (token != null) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          return config;
        },
        function (errEmbedToken) {
          return Promise.reject(errEmbedToken);
        }
      );

      // Self tests.
      return axios
        .get('http://localhost/echo', {
          params: {
            ID: 12345,
          },
        })
        .then(function (response) {
          serverResHeader = response.data.substr(0, 4);
          serverResToken = response.config.headers.Authorization;
        })
        .catch(function (error) {
          error('FAILED sending HTTP GET using axios!');
          error(error);
          return Promise.reject(error);
        });
    });

    //--------------------------------------------------
    // The tests!
    //--------------------------------------------------
    describe('SelfTestSever', () => {
      it('should be an echo server', (done) => {
        expect(serverResHeader).to.equal('Echo');
        done();
      });
      it('should respond with correct token', (done) => {
        expect(serverResToken).to.equal(`Bearer ${FOO_INVALID_TOKEN}`);
        done();
      });
    });

    after(() => {});
  });
}
