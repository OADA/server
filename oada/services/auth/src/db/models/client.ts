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

import { Codes, OADAError } from "@oada/error";
import { Client } from "@oada/models/client";
import type { Except, Promisable } from "type-fest";
import { config } from "../../config.js";

import { getDataStores, type Store, tryDataStores } from "./index.js";

export { Client } from "@oada/models/client";

export interface IClients extends Store {
  findById(id: string): Promisable<Client | undefined>;
  save(client: Except<Client, "client_id">): Promisable<void>;
}

const dataStores = await getDataStores<IClients>(
  config.get("auth.client.dataStore"),
  "clients",
);

export async function findById(id: string) {
  async function findClientById(dataStore: IClients) {
    const c = await dataStore.findById(id);
    return c ? new Client(c) : undefined;
  }

  return tryDataStores(dataStores, findClientById);
}

export async function save(c: Partial<Except<Client, "client_id">>) {
  const client = new Client(c);
  if (await findById(client.client_id)) {
    throw new OADAError(
      "Client Id already exists",
      Codes.BadRequest,
      "There was a problem durring the login",
    );
  }

  // ???: Should it only save to first datastore?
  await dataStores[0]!.save(client);
  const saved = await findById(client.client_id);
  if (!saved) {
    throw new Error("Could not save client");
  }

  return saved;
}
