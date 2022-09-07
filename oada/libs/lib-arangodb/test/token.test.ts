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

import test from 'ava';

import type { UserID } from '../src/libs/users.js';

import { authorizations, init } from '../dist/index.js';

// TODO: Would be nice to just expose these examples on oadaLib itself --- feel
// like we will want them for all of the microservice tests
import exampleTokens from '../dist/libs/exampledocs/authorizations.js';
import exampleUsers from '../dist/libs/exampledocs/users.js';

test.before(init.run);

test('should find a token', async (t) => {
  const token = exampleTokens[0]!;

  const tok = await authorizations.findByToken(token.token);
  t.is(tok?.token, token.token);
  t.is(tok?.createTime, token.createTime);
  t.is(tok?.expiresIn, token.expiresIn);
  t.assert(typeof tok?.user === 'object');
  t.is(tok?.user?._id, token.user._id as UserID);
  t.is(tok?.clientId, token.clientId);
});

test('should save a token', async (t) => {
  const token = exampleTokens[0]!;
  const user = exampleUsers[0]!;

  await authorizations.save({
    ...token, // @ts-expect-error
    _key: `${token._key}-no-duplicates`,
    token: 'abc-no-duplicates',
    user: {
      _id: user._id,
    },
  });

  const tok = await authorizations.findByToken('abc-no-duplicates');
  t.is(tok?.token, 'abc-no-duplicates');
  t.is(tok?.createTime, token.createTime);
  t.is(tok?.expiresIn, token.expiresIn);
  t.assert(typeof tok?.user === 'object');
  t.is(tok?.user._id, user._id as UserID);
  t.is(tok?.clientId, token.clientId);
});

test.after(init.cleanup);
