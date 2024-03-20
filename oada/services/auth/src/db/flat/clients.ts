/**
 * @license
 * Copyright 2017-2022 Open Ag Data Alliance
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

import cloneDeep from 'clone-deep';

import type { Client } from '../models/client.js';

// @ts-expect-error IDEK
import clients from './clients.json';

const database = new Map(Object.entries(clients as Record<string, Client>));

export function findById(id: string) {
  // eslint-disable-next-line unicorn/no-null
  return cloneDeep(database.get(id)) ?? null;
}

export async function save(client: Client) {
  database.set(client.client_id, client);
  return findById(client.client_id);
}
