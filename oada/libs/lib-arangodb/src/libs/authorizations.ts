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

import config from '../config.js';
import { db as database } from '../db.js';
import { sanitizeResult } from '../util.js';
import * as users from './users.js';

import { aql } from 'arangojs';
import debug from 'debug';

const trace = debug('@oada/lib-arangodb#authorizations:trace');

const authorizations = database.collection(
  config.get('arangodb.collections.authorizations.name')
);

export interface Authorization {
  _id: string;
  _rev: number;
  token: string;
  scope: string[];
  createTime: number;
  expiresIn: number;
  user: { _id: string };
  clientId: string;
  revoked?: boolean;
}

export async function findById(id: string): Promise<Authorization | null> {
  return (await (
    await database.query(aql`
      FOR t IN ${authorizations}
        FILTER t._key == ${id}
        RETURN UNSET(t, '_key')`)
  ).next()) as Authorization | null;
}

export async function findByToken(
  token: string
): Promise<(Authorization & { user: users.User }) | null> {
  const t = (await (
    await database.query(
      aql`
      FOR t IN ${authorizations}
        FILTER t.token == ${token}
        RETURN t`
    )
  ).next()) as Authorization | null;

  if (!t) {
    return null;
  }

  // No longer needed with new _id scheme
  // t._id = t._key;

  trace('Found authorization by token (%O), filling out user by user._id', t);
  const user = await users.findById(t.user._id);
  if (!user) {
    throw new Error(`Invalid user ${t.user._id} for token ${token}`);
  }

  return sanitizeResult({ ...t, user });
}

// TODO: Add index on user id
export async function findByUser(
  user: string
): Promise<AsyncIterableIterator<Authorization>> {
  return database.query(aql`
    FOR t IN ${authorizations}
      FILTER t.user._id == ${user}
      FILTER t.revoked != true
      RETURN UNSET(t, '_key')`);
}

export async function save({
  _id,
  ...t
}: Partial<Authorization> & { token: string }): Promise<Authorization | null> {
  // Make sure nothing but id is in user info
  const user = t.user && { _id: t.user._id };
  // Have to get rid of illegal document handle _id
  const _key = _id?.replace(/^authorizations\//, '');

  trace('save: Replacing/Inserting token %s', t);

  // Overwrite will replace the given token if it already exists
  await authorizations.save({ ...t, user, _key }, { overwrite: true });

  return findByToken(t.token);
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
