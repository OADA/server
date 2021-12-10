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
  Testing script 0:
    - A simple self test (for express, axios and chai).
 */

const { expect } = require('chai');
const axios = require('axios');
const Promise = require('bluebird');

// Self test needs the express server. It will verify both axios and chai work
// as expected.
const isSelfTesting = process.env.NODE_ENV === 'selftest';

if (isSelfTesting) {
  const FOO_INVALID_TOKEN = 'foo-invalid-token-tests';

  describe('SelfTest', () => {
    let serverResHeader = '';
    let serverResToken = '';

    before(() => {
      // Embed the token for all HTTP request.
      axios.interceptors.request.use(
        (config) => {
          const token = FOO_INVALID_TOKEN; // Cookie.get(__TOKEN_KEY__);

          if (token != undefined) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          return config;
        },
        (errorEmbedToken) => Promise.reject(errorEmbedToken)
      );

      // Self tests.
      return axios
        .get('http://localhost/echo', {
          params: {
            ID: 12_345,
          },
        })
        .then((response) => {
          serverResHeader = response.data.slice(0, 4);
          serverResToken = response.config.headers.Authorization;
        })
        .catch((error) => {
          error('FAILED sending HTTP GET using axios!');
          error(error);
          return Promise.reject(error);
        });
    });

    // --------------------------------------------------
    // The tests!
    // --------------------------------------------------
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
