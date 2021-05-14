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

import config from '../config';
import { db } from '../db';
import { aql } from 'arangojs';
import * as util from '../util';

/**
 * Representation of a client in the db
 *
 * @todo not sure this is right
 */
export interface Client {
  clientId: string;
  software_id?: string;
  registration_provider?: string;
  token_endpoint_auth_method?: string;
  iat?: number;
  /**
   * I think this one is  @deprecated?
   */
  redirectUrls: string[];
  licenses?: Array<{ id: string; name: string }>;
  /**
   * I think this one is  @deprecated?
   */
  name?: string;
  client_name?: string;
  /**
   * I think this one is  @deprecated?
   */
  contact?: string;
  contacts?: string[];
  puc?: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  policy_uri?: string;
  tos_uri?: string;
  jwks_uri?: string;
  valid?: boolean;
  trusted?: boolean;
}

const clients = db.collection(config.get('arangodb.collections.clients.name'));

export async function findById(id: string): Promise<Client | null> {
  const client: Client | null = await (
    await db.query(
      aql`
      FOR c IN ${clients}
      FILTER c.clientId == ${id}
      RETURN c`
    )
  ).next();

  if (!client) {
    return null;
  }

  return util.sanitizeResult(client);
}

export async function save(client: Client): Promise<Client['clientId']> {
  const { _id } = await clients.save(client);

  return _id;
}
