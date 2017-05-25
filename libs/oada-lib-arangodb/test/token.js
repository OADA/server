/* Copyright 2017 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 )* limitations under the License.
 */

'use strict';

const expect = require('chai').expect;
const Promise = require('bluebird');
const oadaLib = require('..');
const config = require('../config');

// TODO: Would be nice to just expose these examples on oadaLib itself --- feel
// like we will want them for all of the microservice tests
const exampleTokens = require('../libs/exampledocs/tokens.js');
const exampleUsers = require('../libs/exampledocs/users.js');

describe('token lib', () => {
  before(() => oadaLib.init.run());

  it('should find a token', () => {
    const token = exampleTokens[0];

    return oadaLib.tokens.findByToken(token.token)
      .then((t) => {
        expect(t.token).to.equal(token.token);
        expect(t.createTime).to.equal(token.createTime);
        expect(t.expiresIn).to.equal(token.expiresIn);
        expect(t.user).to.be.a('object');
        expect(t.user._id).to.equal(token.user._id);
        expect(t.clientId).to.equal(token.clientId);
      });
  });

  it('should save a token', () => {
    const token = exampleTokens[0];
    const user = exampleUsers[0];

    return oadaLib.tokens.save(Object.assign({}, token, {
        _key: token._key + '-no-duplicates',
        token: 'abc-no-duplicates',
        user: {
          _id: user._key
        }
      }))
      .then(() => oadaLib.tokens.findByToken('abc-no-duplicates'))
      .then(function checkNewToken(t) {
        expect(t.token).to.equal('abc-no-duplicates');
        expect(t.createTime).to.equal(token.createTime);
        expect(t.expiresIn).to.equal(token.expiresIn);
        expect(t.user).to.be.a('object');
        expect(t.user._id).to.equal(user._key);
        expect(t.clientId).to.equal(token.clientId);
      });
  });

  after(() => oadaLib.init.cleanup());
});
