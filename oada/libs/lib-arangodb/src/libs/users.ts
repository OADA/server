/* Copyright 2021 Open Ag Data Alliance
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
 * limitations under the License.
 */

import config from '../config';
import { db } from '../db';
import * as util from '../util';

import { aql } from 'arangojs';
import type { CollectionReadOptions } from 'arangojs/collection';
import bcrypt from 'bcryptjs';
import Bluebird from 'bluebird';
import debug from 'debug';
import flatten from 'flat';

const info = debug('arangodb#resources:info');

const users = db.collection(config.get('arangodb.collections.users.name'));

/**
 * @todo fix this?
 * @example {
    "_id": "users/123frank",
    "username": "frank",
    "password": "test",
    "name": "Farmer Frank",
    "family_name": "Frank",
    "given_name": "Farmer",
    "middle_name": "",
    "nickname": "Frankie",
    "email": "frank@openag.io"
    "oidc": {
      "sub": "02kfj023ifkldf", // subject, i.e. unique ID for this user
      "iss": "https://localhost", // issuer: the domain that gave out this ID
      "username": "bob", // can be used to pre-link this account to openidconnect identity
    }
*/
export interface User {
  _id: string;
  _rev: number;
  username: string;
  password?: string;
  name?: string;
  family_name?: string;
  given_name?: string;
  middle_name?: string;
  nickname?: string;
  email?: string;
  oidc?: {
    sub?: string; // subject, i.e. unique ID for this user
    iss?: string; // issuer: the domain that gave out this ID
    username?: string; // can be used to pre-link this account to openidconnect identity
  };
  bookmarks: { _id: string };
  shares: { _id: string };
  scope: readonly string[];
}

export function findById(
  id: string,
  options?: CollectionReadOptions
): Promise<User | null> {
  return Bluebird.resolve(users.document(id, options))
    .then(util.sanitizeResult)
    .catch({ code: 404 }, () => null);
}

export async function exists(id: string): Promise<boolean> {
  return await users.documentExists(id);
}

export async function findByUsername(username: string): Promise<User | null> {
  const user = (await (
    await db.query(
      aql`
        FOR u IN ${users}
          FILTER u.username == ${username}
          RETURN u`
    )
  ).next()) as User;

  if (!user) {
    return null;
  }

  return util.sanitizeResult(user);
}

export async function findByOIDCUsername(
  oidcusername: string,
  oidcdomain: string
): Promise<User | null> {
  const user = (await (
    await db.query(
      aql`
        FOR u IN ${users}
          FILTER u.oidc.username == ${oidcusername}
          FILTER u.oidc.iss == ${oidcdomain}
          RETURN u`
    )
  ).next()) as User;

  if (!user) {
    return null;
  }

  return util.sanitizeResult(user);
}

/**
 * expects idtoken to be at least
 * { sub: "fkj2o", iss: "https://localhost/example" }
 */
export async function findByOIDCToken(idtoken: {
  sub: string;
  iss: string;
}): Promise<User | null> {
  const user = (await (
    await db.query(
      aql`
        FOR u IN ${users}
          FILTER u.oidc.sub == ${idtoken.sub}
          FILTER u.oidc.iss == ${idtoken.iss}
          RETURN u`
    )
  ).next()) as User;

  if (!user) {
    return null;
  }

  return util.sanitizeResult(user);
}

export async function findByUsernamePassword(
  username: string,
  password: string
): Promise<User | null> {
  const user = await findByUsername(username);
  if (!user) return null;

  const { password: pass } = user;
  return pass && (await bcrypt.compare(password, pass)) ? user : null;
}

export async function create(u: Omit<User, '_id' | '_rev'>): Promise<User> {
  info(u, 'create user was called');

  if (u.password) {
    u.password = hashPw(u.password);
  }

  // Throws if username already exists
  const user = (await users.save(u, { returnNew: true })) as { new: User };
  return user.new || user;
}

// Use this with care because it will completely remove that user document.
export async function remove(u: User): Promise<void> {
  return void (await users.remove(u));
}

export async function update(
  u: { _id: string } & Partial<User>
): Promise<{ _id: string; new: User }> {
  if (u.password) {
    u.password = hashPw(u.password);
  }

  return (await users.update(u._id, u, { returnNew: true })) as {
    _id: string;
    new: User;
  };
}

export async function like(
  u: Partial<User>
): Promise<AsyncIterableIterator<User>> {
  return await users.byExample(flatten(u));
}

export function hashPw(pw: string): string {
  return bcrypt.hashSync(pw, config.get('arangodb.init.passwordSalt'));
}

// TODO: Better way to handler errors?
// ErrorNum from: https://docs.arangodb.com/2.8/ErrorCodes/
export const NotFoundError = {
  name: 'ArangoError',
  errorNum: 1202,
};
export const UniqueConstraintError = {
  name: 'ArangoError',
  errorNum: 1210,
};
