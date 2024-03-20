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

import { Codes, OADAError } from '@oada/error';

import { Client } from '@oada/models/client';
import type { Except } from 'type-fest';

export { Client } from '@oada/models/client';

export interface IClients {
  findById(id: string): Promise<Client | undefined>;
  save(client: Except<Client, 'client_id'>): Promise<void>;
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const datastoresDriver = config.get('auth.datastoresDriver');
const database = (await import(
  path.join(dirname, '..', datastoresDriver, 'clients.js')
)) as IClients;

export async function findById(id: string) {
  const c = await database.findById(id);
  return c ? new Client(c) : undefined;
}

export async function save(c: Partial<Except<Client, 'client_id'>>) {
  const client = new Client(c);
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
