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

import debug from 'debug';

import { authorizations } from '@oada/lib-arangodb';

import type { IToken } from '../models/token.js';

const trace = debug('arango:token:trace');

export async function findByToken(token: string) {
  trace('findByToken: searching for token %s', token);
  const found = await authorizations.findByToken(token);
  if (!found) {
    return found;
  }

  const { _id, ...t } = found;
  if (t?.user) {
    // Why eliminate the _id?
    // Object.assign(t.user, {id: t.user._id, _id: undefined});
  }

  return { ...t, id: _id };
}

export async function save({ id, ...token }: IToken) {
  const t = {
    ...token,
    _id: id,
    // Link user
    user: { _id: token.user.id },
  };
  trace(t, 'save: saving token');
  return authorizations.save(t);
}
