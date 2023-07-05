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

import type { OmitIndexSignature, ReadonlyDeep } from 'type-fest';
import { v4 } from 'uuid';

import { Codes, OADAError } from '@oada/error';
import type { ClientID } from '@oada/lib-arangodb/dist/libs/clients.js';
import type Metadata from '@oada/types/oauth-dyn-reg/metadata.js';
import { makeClass } from '@qlever-llc/interface2class';

export interface IClients {
  findById(id: string): Promise<Client | undefined>;
  save(client: Client): Promise<void>;
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const datastoresDriver = config.get('auth.datastoresDriver');
const database = (await import(
  path.join(dirname, '..', datastoresDriver, 'clients.js')
)) as IClients;

export interface IClient extends ReadonlyDeep<OmitIndexSignature<Metadata>> {
  readonly id?: ClientID;
  readonly client_id: string;
  readonly scope: string;
  readonly reqdomain?: string;
  readonly puc?: string;
  readonly licenses?: ReadonlyArray<{ id: string; name: string }>;
  readonly trusted?: boolean;
  readonly client_secret?: string;
  readonly client_secret_expires_at?: number;
}

export class Client extends makeClass<IClient>() {
  constructor({
    client_id = v4(),
    licenses = [],
    scope = '',
    ...rest
  }: IClient) {
    super({ ...rest, client_id, scope, licenses });
  }
}

export interface DBClient extends Client {
  id: ClientID;
  client_id: string;
}

export async function findById(id: DBClient['client_id']) {
  const c = await database.findById(id);
  return c ? new Client(c) : undefined;
}

export async function save(c: IClient) {
  const client = c instanceof Client ? c : new Client(c);

  if (await database.findById(client.client_id)) {
    throw new OADAError(
      'Client Id already exists',
      Codes.BadRequest,
      'There was a problem durring the login',
    );
  }

  await database.save(client);
  const saved = await findById(client.client_id);
  if (!saved) {
    throw new Error('Could not save client');
  }

  return saved;
}
