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

import { users } from '@oada/lib-arangodb';

import type { IUser } from '../models/user.js';

const trace = debug('arango:user:trace');

function convert(u: users.User | undefined): IUser | undefined {
  if (!u) {
    return u;
  }

  const { _id, ...user } = u;
  return { ...user, id: _id };
}

export async function findById(id: string) {
  trace('findById: searching for user %s', id);
  const user = await users.findById(id);
  return convert(user);
}

export async function findByUsername(username: IUser['username']) {
  trace('findByUsername: searching for user %s', username);
  const user = await users.findByUsername(username);
  return convert(user);
}

export async function findByUsernamePassword(
  username: IUser['username'],
  password: string,
) {
  trace('findByUsername: searching for user %s with  password', username);
  const user = await users.findByUsernamePassword(username, password);
  return convert(user);
}

export async function findByOIDCToken(token: { sub: string; iss: string }) {
  trace(
    'findByOIDCToken: searching for oidc token sub=%s, iss=%s',
    token.sub,
    token.iss,
  );
  const user = await users.findByOIDCToken(token);
  return convert(user);
}

export async function findByOIDCUsername(
  username: IUser['username'],
  domain: string,
) {
  trace(
    'findByOIDCUsername: searching for oidc username %s at %d',
    username,
    domain,
  );
  const user = await users.findByOIDCUsername(username, domain);
  return convert(user);
}

export async function update({ id, ...user }: IUser) {
  await users.update({ ...user, _id: id! });
}
