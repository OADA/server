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

import { config } from "../../config.js";

import { randomBytes } from "node:crypto";

import base36 from "random-id-base36";
import type { Promisable, SetRequired } from "type-fest";

import { destructure } from "@oada/models/decorators";

import { type Store, getDataStores, tryDataStores } from "./index.js";

export interface IDeviceCodes extends Store {
  findByDeviceCode(
    deviceCode: DeviceCode["deviceCode"],
  ): Promisable<Partial<DeviceCode> | undefined>;
  findByUserCode(
    userCode: DeviceCode["userCode"],
  ): Promisable<Partial<DeviceCode> | undefined>;
  save<C extends DeviceCode>(code: C): Promisable<C>;
  redeem(
    code: DeviceCode["deviceCode"],
  ): Promisable<{ redeemed: boolean; code?: DeviceCode }>;
}

const dataStores = await getDataStores<IDeviceCodes>(
  config.get("auth.deviceCode.dataStore"),
  "deviceCodes",
);

// eslint-disable-next-line @typescript-eslint/naming-convention
function _DeviceCode() {
  return `${randomBytes(15).toString("base64")}_${randomBytes(15).toString("base64")}` as const;
}

// eslint-disable-next-line @typescript-eslint/naming-convention
function _UserCode() {
  const id = base36.randId(8);
  return `${id.slice(0, 4).toUpperCase()}-${id.slice(4).toUpperCase()}` as const;
}

export
@destructure
class DeviceCode {
  // @ts-expect-error HACK
  constructor(deviceCode?: Partial<DeviceCode>);

  constructor(
    rest: Partial<DeviceCode> = {},
    readonly clientId: string,
    readonly scope: string,
    /**
     * Machine-readable code for client use
     */
    readonly deviceCode: string = _DeviceCode(),
    /**
     * Human-readable code to present to user
     */
    readonly userCode: string = _UserCode(),
    readonly userId?: string,
    readonly approved?: boolean,
  ) {
    Object.assign(this, rest);
  }
}

export async function findByDeviceCode(deviceCode: DeviceCode["deviceCode"]) {
  async function findDeviceCodeByDeviceCode(dataStore: IDeviceCodes) {
    const c = await dataStore.findByDeviceCode(deviceCode);
    return c ? new DeviceCode(c) : undefined;
  }

  return tryDataStores(dataStores, findDeviceCodeByDeviceCode);
}

export async function findByUserCode(userCode: DeviceCode["userCode"]) {
  async function findDeviceCodeByUserCode(dataStore: IDeviceCodes) {
    const c = await dataStore.findByUserCode(userCode);
    return c ? new DeviceCode(c) : undefined;
  }

  return tryDataStores(dataStores, findDeviceCodeByUserCode);
}

export async function create(c: Partial<DeviceCode>) {
  try {
    const code = c instanceof DeviceCode ? c : new DeviceCode(c);
    const saved = await dataStores[0]!.save(code);
    return new DeviceCode(saved);
  } catch (error: unknown) {
    throw new Error("Failed to create device code", { cause: error });
  }
}

export async function activate(
  deviceCode: SetRequired<DeviceCode, "approved">,
) {
  try {
    await dataStores[0]!.save(deviceCode);
  } catch (error: unknown) {
    throw new Error("Could not activate device code", { cause: error });
  }
}

export async function redeem(
  clientId: string,
  deviceCode: DeviceCode["deviceCode"],
): Promise<{ redeemed: boolean; code?: DeviceCode }> {
  async function redeemDeviceCode(dataStore: IDeviceCodes) {
    const { redeemed, code } = await dataStore.redeem(deviceCode);
    if (!code) {
      return;
    }

    const out = new DeviceCode(code);
    if (code.clientId !== clientId) {
      throw new Error("Client does not match original client");
    }

    return {
      redeemed,
      code: out,
    };
  }

  return (
    (await tryDataStores(dataStores, redeemDeviceCode)) ?? { redeemed: false }
  );
}
