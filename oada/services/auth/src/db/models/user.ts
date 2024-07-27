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

import type { Promisable } from 'type-fest';

import { User } from '@oada/models/user';

import { type Store, getDataStores, tryDataStores } from './index.js';

export interface IUsers extends Store {
  findById(id: string): Promisable<User | undefined>;
  findByUsername(username: User['username']): Promisable<User | undefined>;
  findByUsernamePassword(
    username: User['username'],
    password: User['password'],
  ): Promisable<User | undefined>;
  findByOIDCToken(token: {
    sub: string;
    iss: string;
  }): Promisable<User | undefined>;
  findByOIDCUsername(
    username: User['username'],
    iss: string,
  ): Promisable<User | undefined>;
  update(user: User): Promisable<void>;
  create(user: User): Promisable<User>;
}

const dataStores = await getDataStores<IUsers>(
  config.get('auth.user.dataStore'),
  'users',
);

export { User } from '@oada/models/user';

export async function findById(id: string) {
  async function findUserById(dataStore: IUsers) {
    const u = await dataStore.findById(id);
    return u ? new User(u) : undefined;
  }

  return tryDataStores(dataStores, findUserById);
}

export async function findByUsername(username: User['username']) {
  async function findUserByUsername(dataStore: IUsers) {
    const u = await dataStore.findByUsername(username);
    return u ? new User(u) : undefined;
  }

  return tryDataStores(dataStores, findUserByUsername);
}

export async function findByUsernamePassword(
  username: User['username'],
  password: User['password'],
) {
  async function findUserByUsernamePassword(dataStore: IUsers) {
    const u = await dataStore.findByUsernamePassword(username, password);
    return u ? new User(u) : undefined;
  }

  return tryDataStores(dataStores, findUserByUsernamePassword);
}

export async function findByOIDCToken(token: { sub: string; iss: string }) {
  async function findUserByOIDCToken(dataStore: IUsers) {
    const u = await dataStore.findByOIDCToken(token);
    return u ? new User(u) : undefined;
  }

  return tryDataStores(dataStores, findUserByOIDCToken);
}

export async function findByOIDCUsername(
  username: User['username'],
  iss: string,
) {
  async function findUserByOIDCUsername(dataStore: IUsers) {
    const u = await dataStore.findByOIDCUsername(username, iss);
    return u ? new User(u) : undefined;
  }

  return tryDataStores(dataStores, findUserByOIDCUsername);
}

export async function update(user: User): Promise<void> {
  // ???: Should it only save to first datastore?
  await dataStores[0]!.update(user);
}

/**
 * Register a user who is new to us and initialize associated metadata.
 * They may already have an existing account with another OIDC provider.
 */
export async function register(user: Partial<User>) {
  // ???: Should it only save to first datastore?
  return dataStores[0]!.create(new User(user));
}
