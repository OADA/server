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

import { User, findById } from './users.js';
import config from '../config.js';
import { db as database } from '../db.js';
import { sanitizeResult } from '../util.js';

import { aql } from 'arangojs';

export interface Code {
  code: string;
  scope: string[];
  nonce?: string;
  user: { _id: string };
  createTime: number;
  expiresIn: number;
  redeemed: boolean;
  clientId: string;
  redirectUri: string;
}

const codes = database.collection(
  config.get('arangodb.collections.codes.name')
);

export async function findByCode(
  code: string
): Promise<(Code & { user: User }) | undefined> {
  const c = (await (
    await database.query(
      aql`
      FOR c IN ${codes}
      FILTER c.code == ${code}
      RETURN c`
    )
  ).next()) as Code | null;

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
  code: Code
): Promise<(Code & { user: User }) | undefined> {
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
