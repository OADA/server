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

import { config } from "../config.js";
import { db as database } from "../db.js";
import { findById as findUserById } from "./users.js";
import { sanitizeResult } from "../util.js";

import type { Except, Opaque } from "type-fest";
import { aql } from "arangojs";
import debug from "debug";

const trace = debug("@oada/lib-arangodb#authorizations:trace");

const authorizations = database.collection<Authorization>(
  config.get("arangodb.collections.authorizations.name"),
);

export type AuthorizationID = Opaque<string, Authorization>;

export interface Authorization {
  _id: string;
  token: string;
  scope: readonly string[];
  createTime: number;
  expiresIn: number;
  user: { sub: string };
  clientId: string;
  revoked?: boolean;
}

function fixup({ user, ...rest }: Authorization) {
  return {
    ...rest,
    user: {
      sub:
        user.sub ??
        // @ts-expect-error old style
        user._id,
    },
  };
}

export async function findById(id: string): Promise<Authorization | undefined> {
  const cursor = await database.query(aql`
    FOR t IN ${authorizations}
      FILTER t._key == ${id}
      RETURN UNSET(t, '_key')`);

  const t = (await cursor.next()) as Authorization | undefined;
  return t ? fixup(t) : undefined;
}

export async function findByToken(
  token: string,
): Promise<Authorization | undefined> {
  const cursor = await database.query(
    aql`
      FOR t IN ${authorizations}
        FILTER t.token == ${token}
        RETURN t`,
  );

  const t = (await cursor.next()) as Authorization | undefined;

  if (!t) {
    return undefined;
  }

  const auth = fixup(t);
  trace({ auth }, "Found authorization by token, filling out user by user.sub");
  const user = await findUserById(auth.user.sub);
  if (!user) {
    throw new Error(`Invalid user ${auth.user.sub} for authorization ${t._id}`);
  }

  return sanitizeResult({ ...auth, user });
}

// TODO: Add index on user id
export async function findByUser(
  user: string,
): Promise<AsyncIterable<Authorization>> {
  return database.query<Authorization>(aql`
    FOR t IN ${authorizations}
      FILTER t.user.sub == ${user}
      FILTER t.revoked != true
      RETURN UNSET(MERGE(t, {user: {sub: ${user}}})), '_key')`);
}

export async function save(
  auth: Except<Authorization, "_id">,
): Promise<Authorization> {
  // Make sure nothing but id is in user info
  const user = { sub: auth.user.sub };
  // Have to get rid of illegal document handle _id

  trace({ auth, user }, "save: Replacing/Inserting token");

  const _id = undefined as unknown as AuthorizationID;

  // Overwrite will replace the given token if it already exists
  const t = await authorizations.save(
    { ...auth, user, _id },
    { overwriteMode: "replace" },
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
