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

import type { ReadDocumentOptions } from 'arangojs/documents';
import { aql } from 'arangojs';
import bcrypt from 'bcryptjs';
import debug from 'debug';

import type { Selector } from '../util.js';
import { config } from '../config.js';
import { db as database } from '../db.js';
import { sanitizeResult } from '../util.js';

import type { User as IUser } from '@oada/models/user';
import type { SetRequired } from 'type-fest';

export interface User extends IUser {
  /** @deprecated use sub/_key instead */
  _id?: `users/${string}`;
  _key?: string;
}

const info = debug('arangodb#resources:info');

const users = database.collection<User>(
  config.get('arangodb.collections.users.name'),
);

const roundsOrSalt =
  config.get('bcrypt.saltRounds') || config.get('bcrypt.salt');

export async function findById(
  sub: string,
  options?: ReadDocumentOptions,
): Promise<User | undefined> {
  try {
    const result = await users.document(sub, options);
    return result ? sanitizeResult(result) : undefined;
  } catch (error: unknown) {
    // @ts-expect-error errors in TS are annoying
    if (error?.code === 404) {
      return undefined;
    }

    throw error;
  }
}

export async function exists(sub: string): Promise<boolean> {
  return users.documentExists(sub);
}

export async function findByUsername(
  username: string,
): Promise<User | undefined> {
  const cursor = await database.query<User>(
    aql`
      FOR u IN ${users}
        FILTER u.username == ${username}
        RETURN u`,
  );
  const user = await cursor.next();

  return user ? sanitizeResult(user) : undefined;
}

export async function findByOIDCUsername(
  oidcUsername: string,
  oidcDomain: string,
): Promise<User | undefined> {
  const cursor = await database.query<User>(
    aql`
      FOR u IN ${users}
        FILTER u.oidc.username == ${oidcUsername}
        FILTER u.oidc.iss == ${oidcDomain}
        RETURN u`,
  );
  const user = await cursor.next();

  return user ? sanitizeResult(user) : undefined;
}

/**
 * Expects idToken to be at least
 * { sub: "fkj2o", iss: "https://localhost/example" }
 */
export async function findByOIDCToken(idToken: {
  sub: string;
  iss: string;
}): Promise<User | undefined> {
  const cursor = await database.query<User>(
    aql`
      FOR u IN ${users}
        FOR oidc IN u.oidc
          FILTER oidc.iss == ${idToken.iss}
          FILTER oidc.sub == ${idToken.sub}
          RETURN u`,
  );
  const user = await cursor.next();

  return user ? sanitizeResult(user) : undefined;
}

export async function findByUsernamePassword(
  username: string,
  password: string,
): Promise<User | undefined> {
  const user = await findByUsername(username);
  if (!user) {
    return undefined;
  }

  const { password: pass } = user;
  const passed = pass && (await bcrypt.compare(password, pass));
  return passed ? user : undefined;
}

/**
 * @throws if user already exists
 */
export async function create(user: User): Promise<User> {
  info({ user }, 'Create user was called');

  user.password &&= await hashPw(user.password);

  const u = await users.save(
    {
      ...user,
      // @ts-expect-error HACK for old users
      _id: user.sub,
      _key: user.sub,
    },
    { returnNew: true },
  );
  return sanitizeResult(u.new);
}

// Use this with care because it will completely remove that user document.
export async function remove(u: Selector<User>): Promise<void> {
  await users.remove(u);
}

export async function update(
  user: SetRequired<Partial<User>, 'sub'>,
): Promise<User> {
  info({ user }, 'Update user was called');
  user.password &&= await hashPw(user.password);

  const u = await users.update({ _key: user.sub }, user, {
    returnNew: true,
  });
  return sanitizeResult(u.new);
}

export async function hashPw(pw: string): Promise<string> {
  return bcrypt.hash(pw, roundsOrSalt);
}
