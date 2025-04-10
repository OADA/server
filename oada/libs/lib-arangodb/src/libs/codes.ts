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

import { aql } from "arangojs";
import type { Opaque } from "type-fest";

import { config } from "../config.js";
import { db as database } from "../db.js";
import { sanitizeResult } from "../util.js";

export type CodeID = Opaque<string, Code>;
export interface Code {
  _id?: CodeID;
  _rev?: number;
  code: string;
  scope: readonly string[];
  nonce?: string;
  user: string;
  createTime: number;
  expiresIn: number;
  redeemed: boolean;
  clientId: string;
  redirectUri: string;
}
export type DBCode = {
  _id: CodeID;
  _rev: number;
} & Code;

const codes = database.collection(
  config.get("arangodb.collections.codes.name"),
);

export async function findByCode(code: string): Promise<DBCode | undefined> {
  const cursor = await database.query<DBCode>(
    aql`
      FOR c IN ${codes}
      FILTER c.code == ${code}
      RETURN c`,
  );

  const c = await cursor.next();
  return c ? sanitizeResult(c) : undefined;
}

export async function save(
  code: Partial<Code> & { code: string },
): Promise<DBCode | undefined> {
  await database.query(aql`
    UPSERT { code: ${code.code} }
    INSERT ${code}
    UPDATE ${code}
    IN ${codes}
  `);

  return findByCode(code.code);
}
