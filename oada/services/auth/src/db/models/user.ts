/**
 * @license
 * Copyright 2017-2022 Open Ag Data Alliance
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

import { config } from '../../config.js';

import path from 'node:path';
import url from 'node:url';

import { User } from '@oada/models/user';

import type { Except } from 'type-fest';

export interface IUsers {
  findById(id: string): Promise<User | undefined>;
  findByUsername(username: User['username']): Promise<User | undefined>;
  findByUsernamePassword(
    username: User['username'],
    password: User['password'],
  ): Promise<User | undefined>;
  findByOIDCToken(token: {
    sub: string;
    iss: string;
  }): Promise<User | undefined>;
  findByOIDCUsername(
    username: User['username'],
    iss: string,
  ): Promise<User | undefined>;
  update(user: User): Promise<void>;
  create(user: Omit<User, '_id'>): Promise<User>;
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const datastoresDriver = config.get('auth.datastoresDriver');
const database = (await import(
  path.join(dirname, '..', datastoresDriver, 'users.js')
)) as IUsers;

export { User } from '@oada/models/user';

export async function findById(id: string) {
  const u = await database.findById(id);
  return u ? new User(u) : undefined;
}

export async function findByUsername(username: User['username']) {
  const u = await database.findByUsername(username);
  return u ? new User(u) : undefined;
}

export async function findByUsernamePassword(
  username: User['username'],
  password: User['password'],
) {
  const u = await database.findByUsernamePassword(username, password);
  return u ? new User(u) : undefined;
}

export async function findByOIDCToken(token: { sub: string; iss: string }) {
  const u = await database.findByOIDCToken(token);
  return u ? new User(u) : undefined;
}

export async function findByOIDCUsername(
  username: User['username'],
  iss: string,
) {
  const u = await database.findByOIDCUsername(username, iss);
  return u ? new User(u) : undefined;
}

export async function update(user: User): Promise<void> {
  await database.update(user);
}

/**
 * Register a user who is new to us and initialize associated metadata.
 * They may already have an existing account with another OIDC provider.
 */
export async function register(user: Except<Partial<User>, '_id'>) {
  return database.create(new User(user));
}
