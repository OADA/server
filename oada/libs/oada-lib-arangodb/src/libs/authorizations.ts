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

import { aql } from 'arangojs';
import debug from 'debug';

import { db } from '../db';
import * as util from '../util';
import * as users from './users';

import config from '../config';

const trace = debug('@oada/lib-arangodb#authorizations:trace');

const authorizations = db.collection(
  config.get('arangodb.collections.authorizations.name')
);

export interface Authorization {
  _id: string;
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
    await db.query(aql`
      FOR t IN ${authorizations}
        FILTER t._key == ${id}
        RETURN UNSET(t, '_key')`)
  ).next()) as Authorization | null;
}

export async function findByToken(
  token: string
): Promise<(Authorization & { user: users.User }) | null> {
  const t = (await (
    await db.query(
      aql`
      FOR t IN ${authorizations}
        FILTER t.token == ${token}
        RETURN t`
    )
  ).next()) as Authorization | null;

  if (!t) {
    return null;
  }

  // no longer needed with new _id scheme
  //t._id = t._key;

  trace('Found authorization by token (%O), filling out user by user._id', t);
  const user = await users.findById(t.user._id);
  if (!user) {
    throw new Error(`Invalid user ${t.user._id} for token ${token}`);
  }

  return util.sanitizeResult({ ...t, user });
}

// TODO: Add index on user id
export function findByUser(user: string) {
  const cur = db.query(aql`
    FOR t IN ${authorizations}
      FILTER t.user._id == ${user}
      FILTER t.revoked != true
      RETURN UNSET(t, '_key')`);

  return util.bluebirdCursor<Authorization>(cur);
}

export async function save({
  _id,
  ...t
}: Partial<Authorization> & { token: string }) {
  // make sure nothing but id is in user info
  const user = t.user && { _id: t.user._id };
  // Have to get rid of illegal document handle _id
  const _key = _id?.replace(/^authorizations\//, '');

  trace('save: Replacing/Inserting token %s', t);

  // overwrite will replace the given token if it already exists
  await authorizations.save({ ...t, user, _key }, { overwrite: true });

  return await findByToken(t.token);
}

export async function revoke(token: Authorization | string) {
  await db.query(aql`
    UPDATE ${token} WITH { revoked: true } IN ${authorizations}
  `);
}

/**
 * Use with case: completely removes the authorization document from database:
 */
export async function remove(a: Authorization) {
  return await authorizations.remove(a);
}
