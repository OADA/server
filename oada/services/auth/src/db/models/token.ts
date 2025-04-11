/**
 * @license
 * Copyright 2017-2024 Open Ag Data Alliance
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

import { config } from "../../config.js";

import debug from "debug";
import type { Promisable } from "type-fest";

import { Authorization as Token } from "@oada/models/authorization";

import { type Store, getDataStores, tryDataStores } from "./index.js";

const log = debug("model-tokens");

export interface ITokens extends Store {
  /**
   * Verify a token and return the associated claims
   */
  verify(token: string, issuer?: string): Promisable<Partial<Token>>;
  /**
   * Create and persist (save to db, sign, etc.) a new token
   */
  create(token: Token): Promisable<string>;
  revoke(token: Token): Promisable<void>;
}

const dataStores = await getDataStores<ITokens>(
  config.get("auth.token.dataStore"),
  "tokens",
);

export async function verify(token: string, issuer?: string) {
  async function verifyToken(dataStore: ITokens) {
    const t = await dataStore.verify(token, issuer);
    return t ? new Token(t) : undefined;
  }

  return tryDataStores(dataStores, verifyToken);
}

export async function create(t: Partial<Token>, issuer?: string) {
  const token = t instanceof Token ? t : new Token({ ...t, iss: issuer });
  log(token, "save: saving token ");

  // ???: Should it only save to first datastore?
  const saved = await dataStores[0]!.create(token);
  if (!saved) {
    throw new Error("Could not save token");
  }

  return saved;
}

export { Authorization as Token } from "@oada/models/authorization";
