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

import { config } from '../../config.js';

import path from 'node:path';
import url from 'node:url';

import type { ReadonlyDeep, RemoveIndexSignature } from 'type-fest';
import { v4 } from 'uuid';

import { Codes, OADAError } from '@oada/error';
import type { ClientID } from '@oada/lib-arangodb/dist/libs/clients.js';
import type Metadata from '@oada/types/oauth-dyn-reg/metadata.js';

export interface IClients {
  findById(id: Client['clientId']): Promise<Client | undefined>;
  save(client: Client): Promise<void>;
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const datastoresDriver = config.get('auth.datastoresDriver');
const database = (await import(
  path.join(dirname, '..', datastoresDriver, 'clients.js')
)) as IClients;

export interface IClient extends ReadonlyDeep<RemoveIndexSignature<Metadata>> {
  readonly id?: ClientID;
  readonly clientId?: string;
  readonly reqdomain?: string;
  readonly client_name?: string;
  readonly contact?: string;
  readonly puc?: string;
  readonly licenses?: ReadonlyArray<{ id: string; name: string }>;
  readonly keys?: ReadonlyArray<{ kty: string; use: string; alg: string }>;
  readonly redirect_uris: readonly [string, ...(readonly string[])];
}
export class Client implements IClient {
  readonly id;
  readonly clientId;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly client_name;
  readonly contact;
  readonly puc;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly redirect_uris;
  readonly licenses;
  readonly keys;
  // eslint-disable-next-line @typescript-eslint/naming-convention
  readonly jwks_uri;
  readonly jwks;
  readonly reqdomain;

  constructor({
    id,
    clientId = v4(),
    client_name: name,
    contact,
    puc,
    redirect_uris: redirectUris,
    licenses = [],
    keys,
    jwks_uri: jwksUri,
    jwks,
    reqdomain,
  }: IClient) {
    this.id = id;
    this.clientId = clientId;
    this.client_name = name;
    this.contact = contact;
    this.puc = puc;
    this.redirect_uris = redirectUris;
    this.licenses = licenses;
    this.keys = keys;
    this.jwks_uri = jwksUri;
    this.jwks = jwks;
    this.reqdomain = reqdomain;
  }
}

export interface DBClient extends Client {
  id: ClientID;
  clientId: string;
}

export async function findById(id: DBClient['clientId']) {
  const c = await database.findById(id);
  return c ? new Client(c) : undefined;
}

export async function save(c: IClient) {
  const client = c instanceof Client ? c : new Client(c);

  if (await database.findById(client.clientId)) {
    throw new OADAError(
      'Client Id already exists',
      Codes.BadRequest,
      'There was a problem durring the login'
    );
  }

  await database.save(client);
  const saved = await findById(client.clientId);
  if (!saved) {
    throw new Error('Could not save client');
  }

  return saved;
}
