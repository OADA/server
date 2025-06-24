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

import { clients } from "@oada/lib-arangodb";
import debug from "debug";

import type { Client, IClients } from "../models/client.js";

const trace = debug("arango:client:trace");

export const findById = (async (id: string) => {
  trace('Retrieving client { client_id: "%s" }', id);
  const found = await clients.findById(id);
  if (!found) {
    return found;
  }

  const { _id, ...client } = found;
  return { ...client, id: _id as string };
}) satisfies IClients["findById"];

export const save = (async (client: Client) => {
  trace("Saving clientId %s", client.client_id);
  await clients.save(client);
}) satisfies IClients["save"];
