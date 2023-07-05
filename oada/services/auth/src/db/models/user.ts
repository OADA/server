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

import type { UserID } from '@oada/lib-arangodb/dist/libs/users.js';

export interface IUsers {
  findById(id: string): Promise<User | undefined>;
  findByUsername(username: IUser['username']): Promise<User | undefined>;
  findByUsernamePassword(
    username: IUser['username'],
    password: IUser['password'],
  ): Promise<User | undefined>;
  findByOIDCToken(token: {
    sub: string;
    iss: string;
  }): Promise<User | undefined>;
  findByOIDCUsername(
    username: IUser['username'],
    iss: string,
  ): Promise<User | undefined>;
  update(user: IUser): Promise<void>;
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const datastoresDriver = config.get('auth.datastoresDriver');
const database = (await import(
  path.join(dirname, '..', datastoresDriver, 'users.js')
)) as IUsers;

export interface IUser {
  readonly id?: UserID;
  readonly username: string;
  readonly password?: string;
  readonly domain?: string;
  reqdomain?: string;
  readonly name?: string;
  readonly email?: string;
  readonly oidc?: {
    sub?: string; // Subject, i.e. unique ID for this user
    iss?: string; // Issuer: the domain that gave out this ID
    username?: string; // Can be used to pre-link this account to openidconnect identity
  };
}
export class User implements IUser {
  readonly id;
  readonly username;
  readonly password;
  readonly domain;
  reqdomain;
  readonly name;
  readonly email;
  readonly oidc;

  constructor({
    id,
    username,
    password,
    domain,
    reqdomain,
    name,
    email,
    oidc,
  }: IUser) {
    this.id = id;
    this.username = username;
    this.password = password;
    this.domain = domain;
    this.reqdomain = reqdomain;
    this.name = name;
    this.email = email;
    this.oidc = oidc;
  }
}

export interface DBUser extends User {
  id: UserID;
}

export async function findById(id: string) {
  const u = await database.findById(id);
  return u ? new User(u) : undefined;
}

export async function findByUsername(username: IUser['username']) {
  const u = await database.findByUsername(username);
  return u ? new User(u) : undefined;
}

export async function findByUsernamePassword(
  username: IUser['username'],
  password: IUser['password'],
) {
  const u = await database.findByUsernamePassword(username, password);
  return u ? new User(u) : undefined;
}

export async function findByOIDCToken(token: { sub: string; iss: string }) {
  const u = await database.findByOIDCToken(token);
  return u ? new User(u) : undefined;
}

export async function findByOIDCUsername(
  username: IUser['username'],
  iss: string,
) {
  const u = await database.findByOIDCUsername(username, iss);
  return u ? new User(u) : undefined;
}

export async function update(user: IUser): Promise<void> {
  await database.update(user);
}
