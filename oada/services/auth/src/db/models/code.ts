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

import type { CodeID } from "@oada/lib-arangodb/dist/libs/codes.js";

import debug from "debug";
import { config } from "../../config.js";

import { getDataStores, type Store, tryDataStores } from "./index.js";

const trace = debug("model-codes:trace");

export interface ICodes extends Store {
  findByCode(code: Code["code"]): Promise<ICode | undefined>;
  save(code: Code): Promise<void>;
}

const dataStores = await getDataStores<ICodes>(
  config.get("auth.code.dataStore"),
  "codes",
);

export interface ICode {
  readonly id?: CodeID;
  readonly code: string;
  readonly nonce?: string;
  readonly scope?: readonly string[];
  readonly user: string;
  readonly clientId: string;
  readonly createTime?: number;
  readonly expiresIn?: number;
  readonly redeemed?: boolean;
  readonly redirectUri: string;
}
export class Code implements ICode {
  readonly id;
  readonly code;
  readonly nonce;
  readonly scope;
  readonly user;
  readonly clientId;
  readonly createTime;
  readonly expiresIn;
  redeemed;
  readonly redirectUri;

  constructor({
    id,
    code,
    nonce,
    scope = [],
    user,
    clientId,
    createTime = Date.now(),
    expiresIn = 60,
    redeemed = false,
    redirectUri,
  }: ICode) {
    this.id = id;
    this.code = code;
    this.nonce = nonce;
    this.scope = scope;
    this.user = user;
    this.clientId = clientId;
    this.createTime = createTime;
    this.expiresIn = expiresIn;
    this.redeemed = redeemed;
    this.redirectUri = redirectUri;

    if (!this.isValid()) {
      throw new Error("Invalid code");
    }
  }

  isValid() {
    return (
      typeof this.code === "string" &&
      Array.isArray(this.scope) &&
      typeof this.user === "object" &&
      typeof this.clientId === "string" &&
      typeof this.redirectUri === "string"
    );
  }

  isExpired() {
    return this.createTime + this.expiresIn > Date.now();
  }

  matchesClientId(clientId: string) {
    return this.clientId === clientId;
  }

  matchesRedirectUri(redirectUri: string) {
    return this.redirectUri === redirectUri;
  }

  isRedeemed() {
    return this.redeemed;
  }

  async redeem() {
    this.redeemed = true;

    trace("makeCode#redeem: saving redeemed code ", this.code);
    await dataStores[0]!.save(this);

    const redeemed = await findByCode(this.code);
    if (!redeemed) {
      throw new Error("Could not redeem code");
    }

    return redeemed;
  }
}

export async function findByCode(code: Code["code"]) {
  async function findCodeByCode(dataStore: ICodes) {
    const c = await dataStore.findByCode(code);
    return c ? new Code(c) : undefined;
  }

  return tryDataStores(dataStores, findCodeByCode);
}

export async function save(c: ICode) {
  const code = c instanceof Code ? c : new Code(c);

  await dataStores[0]!.save(code);
  const saved = await findByCode(code.code);
  if (!saved) {
    throw new Error("Could not save code");
  }

  return saved;
}
