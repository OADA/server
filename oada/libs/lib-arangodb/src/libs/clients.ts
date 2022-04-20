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

import { config } from '../config.js';
import { db as database } from '../db.js';
import { sanitizeResult } from '../util.js';

export type ClientID = Opaque<string, Client>;
/**
 * Representation of a client in the db
 *
 * @todo not sure this is right
 */
export interface Client {
  _id?: ClientID;
  _rev?: number;
  clientId: string;
  software_id?: string;
  registration_provider?: string;
  token_endpoint_auth_method?: string;
  iat?: number;
  licenses?: ReadonlyArray<{ id: string; name: string }>;
  /**
   * I think this one is  @deprecated?
   */
  name?: string;
  client_name?: string;
  /**
   * I think this one is  @deprecated?
   */
  contact?: string;
  contacts?: readonly string[];
  puc?: string;
  /**
   * I think this one is  @deprecated?
   */
  redirectUrls?: readonly string[];
  redirect_uris: readonly [string, ...(readonly string[])];
  grant_types?: readonly string[];
  response_types?: readonly string[];
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
  valid?: boolean;
  trusted?: boolean;
}
export interface DBClient extends Client {
  _id: ClientID;
  _rev: number;
}

const clients = database.collection(
  config.get('arangodb.collections.clients.name')
);

export async function findById(id: string): Promise<DBClient | undefined> {
  const cursor = await database.query(
    aql`
      FOR c IN ${clients}
      FILTER c.clientId == ${id}
      RETURN c`
  );
  // eslint-disable-next-line @typescript-eslint/ban-types
  const client = (await cursor.next()) as DBClient | null;
  return client ? sanitizeResult(client) : undefined;
}

export async function save(client: Client): Promise<ClientID> {
  const { _id } = (await clients.save(client)) as unknown as { _id: ClientID };

  return _id;
}
