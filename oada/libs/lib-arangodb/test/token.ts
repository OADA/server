/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
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

import { expect } from 'chai';
import { authorizations, init } from '../src';

// TODO: Would be nice to just expose these examples on oadaLib itself --- feel
// like we will want them for all of the microservice tests
import exampleTokens from '../src/libs/exampledocs/authorizations';
import exampleUsers from '../src/libs/exampledocs/users';

describe('token lib', () => {
  before(init.run);

  it('should find a token', async () => {
    const token = exampleTokens[0]!;

    return authorizations.findByToken(token.token).then((t) => {
      expect(t?.token).to.equal(token.token);
      expect(t?.createTime).to.equal(token.createTime);
      expect(t?.expiresIn).to.equal(token.expiresIn);
      expect(t?.user).to.be.a('object');
      expect(t?.user?._id).to.equal(token.user._id);
      expect(t?.clientId).to.equal(token.clientId);
    });
  });

  it('should save a token', async () => {
    const token = exampleTokens[0]!;
    const user = exampleUsers[0]!;

    return authorizations
      .save({
        ...token, // @ts-expect-error
        _key: `${token._key}-no-duplicates`,
        token: 'abc-no-duplicates',
        user: {
          _id: user._id,
        },
      })
      .then(async () => authorizations.findByToken('abc-no-duplicates'))
      .then(function checkNewToken(t) {
        expect(t?.token).to.equal('abc-no-duplicates');
        expect(t?.createTime).to.equal(token.createTime);
        expect(t?.expiresIn).to.equal(token.expiresIn);
        expect(t?.user).to.be.a('object');
        expect(t?.user._id).to.equal(user._id);
        expect(t?.clientId).to.equal(token.clientId);
      });
  });

  after(init.cleanup);
});
