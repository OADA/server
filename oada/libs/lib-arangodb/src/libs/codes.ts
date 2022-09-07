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

import type { Opaque } from 'type-fest';
import { aql } from 'arangojs';

import type { DBUser, UserID } from './users.js';
import { config } from '../config.js';
import { db as database } from '../db.js';
import { findById } from './users.js';
import { sanitizeResult } from '../util.js';

export type CodeID = Opaque<string, Code>;
export interface Code {
  _id?: CodeID;
  _rev?: number;
  code: string;
  scope: readonly string[];
  nonce?: string;
  user: { _id: UserID };
  createTime: number;
  expiresIn: number;
  redeemed: boolean;
  clientId: string;
  redirectUri: string;
}
export interface DBCode extends Code {
  _id: CodeID;
  _rev: number;
}

const codes = database.collection(
  config.get('arangodb.collections.codes.name')
);

export async function findByCode(
  code: string
): Promise<(DBCode & { user: DBUser }) | undefined> {
  const cursor = await database.query(
    aql`
      FOR c IN ${codes}
      FILTER c.code == ${code}
      RETURN c`
  );
  // eslint-disable-next-line @typescript-eslint/ban-types
  const c = (await cursor.next()) as DBCode | null;

  if (!c) {
    return undefined;
  }

  // Removed this since we now have arango's _id === oada's _id
  // c._id = c._key;

  const user = await findById(c.user._id);
  if (!user) {
    throw new Error(`Invalid user ${c.user._id} for code ${code}`);
  }

  return sanitizeResult({ ...c, user });
}

export async function save(
  code: Partial<Code> & { code: string }
): Promise<(DBCode & { user: DBUser }) | undefined> {
  await database.query(aql`
    UPSERT { code: ${code.code} }
    INSERT ${code}
    UPDATE ${code}
    IN ${codes}
  `);

  return findByCode(code.code);
  /* This old method doesn't work because it only inserts:
  return db.collection(config.get('arangodb:collections:codes:name'))
    .save(code)
    .then(() => findByCode(code.code));
  */
}
