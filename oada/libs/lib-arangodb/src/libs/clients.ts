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

import { config } from "../config.js";
import { db as database } from "../db.js";
import { sanitizeResult } from "../util.js";

import type { Client } from "@oada/models/client";
import type { Opaque } from "type-fest";

export type DBClientID = Opaque<string, DBClient>;
export type DBClient = {
  _id: DBClientID;
} & Client;

const clients = database.collection<Client>(
  config.get("arangodb.collections.clients.name"),
);

export async function findById(id: string): Promise<DBClient | undefined> {
  const cursor = await database.query<DBClient>(
    aql`
      FOR c IN ${clients}
      FILTER c.client_id == ${id}
      RETURN c`,
  );
  const client = await cursor.next();
  return client ? sanitizeResult(client) : undefined;
}

export async function save(client: Client): Promise<DBClientID> {
  const { _id } = await clients.save(client);
  return _id as DBClientID;
}
