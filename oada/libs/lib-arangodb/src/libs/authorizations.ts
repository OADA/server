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

import type { User } from '@oada/models/user';
import { config } from '../config.js';
import { db as database } from '../db.js';
import { findById as findUserById } from './users.js';
import { sanitizeResult } from '../util.js';

import type { Except, Opaque } from 'type-fest';
import { aql } from 'arangojs';
import debug from 'debug';

const trace = debug('@oada/lib-arangodb#authorizations:trace');

const authorizations = database.collection<Authorization>(
  config.get('arangodb.collections.authorizations.name'),
);

export type AuthorizationID = Opaque<string, Authorization>;

export interface Authorization {
  _id: string;
  token: string;
  scope: readonly string[];
  createTime: number;
  expiresIn: number;
  user: { _id: string };
  clientId: string;
  revoked?: boolean;
}

export async function findById(id: string): Promise<Authorization | undefined> {
  const cursor = await database.query(aql`
    FOR t IN ${authorizations}
      FILTER t._key == ${id}
      RETURN UNSET(t, '_key')`);

  // eslint-disable-next-line @typescript-eslint/ban-types
  const t = (await cursor.next()) as Authorization | null;
  return t ?? undefined;
}

export async function findByToken(
  token: string,
): Promise<(Authorization & { user: User }) | undefined> {
  const cursor = await database.query(
    aql`
      FOR t IN ${authorizations}
        FILTER t.token == ${token}
        RETURN t`,
  );
  // eslint-disable-next-line @typescript-eslint/ban-types
  const auth = (await cursor.next()) as Authorization | null;

  if (!auth) {
    return undefined;
  }

  // No longer needed with new _id scheme
  // t._id = t._key;

  trace({ auth }, 'Found authorization by token, filling out user by user._id');
  const user = await findUserById(auth.user._id);
  if (!user) {
    throw new Error(`Invalid user ${auth.user._id} for token ${token}`);
  }

  return sanitizeResult({ ...auth, user });
}

// TODO: Add index on user id
export async function findByUser(
  user: string,
): Promise<AsyncIterable<Authorization>> {
  return database.query<Authorization>(aql`
    FOR t IN ${authorizations}
      FILTER t.user._id == ${user}
      FILTER t.revoked != true
      RETURN UNSET(t, '_key')`);
}

export async function save(
  auth: Except<Authorization, '_id'>,
): Promise<Authorization> {
  // Make sure nothing but id is in user info
  const user = { _id: auth.user._id };
  // Have to get rid of illegal document handle _id

  trace({ auth, user }, 'save: Replacing/Inserting token');

  const _id = undefined as unknown as AuthorizationID;

  // Overwrite will replace the given token if it already exists
  const t = await authorizations.save(
    { ...auth, user, _id },
    { overwriteMode: 'replace' },
  );

  return t.new!;
}

export async function revoke(token: Authorization | string): Promise<void> {
  await database.query(aql`
    UPDATE ${token} WITH { revoked: true } IN ${authorizations}
  `);
}

/**
 * Use with case: completely removes the authorization document from database:
 */
export async function remove(a: Authorization): Promise<{ _id: string }> {
  return authorizations.remove(a);
}
