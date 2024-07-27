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

import { aql } from 'arangojs';

import { config } from '../config.js';
import { db as database } from '../db.js';
import { sanitizeResult } from '../util.js';

export interface DeviceCode {
  deviceCode: string;
  userCode: string;
}

const deviceCodes = database.collection<DeviceCode>(
  config.get('arangodb.collections.deviceCodes.name'),
);

export async function findByDeviceCode(
  deviceCode: string,
): Promise<DeviceCode | undefined> {
  const cursor = await database.query<DeviceCode>(
    aql`
      FOR c IN ${deviceCodes}
        FILTER c.deviceCode == ${deviceCode}
        RETURN c`,
  );

  const c = await cursor.next();
  return c ? sanitizeResult(c) : undefined;
}

export async function findByUserCode(
  userCode: string,
): Promise<DeviceCode | undefined> {
  const cursor = await database.query<DeviceCode>(
    aql`
      FOR c IN ${deviceCodes}
        FILTER c.userCode == ${userCode}
        RETURN c`,
  );

  const c = await cursor.next();
  return c ? sanitizeResult(c) : undefined;
}

export async function save(
  deviceCode: DeviceCode,
): Promise<DeviceCode | undefined> {
  const { new: saved } = await deviceCodes.save(deviceCode, { returnNew: true });
  return saved;
}

export async function redeem(deviceCode: string) {
  const cursor = await database.query<{ redeemed: boolean, code?: DeviceCode }>(
    aql`
        LET code = (
          FOR c IN ${deviceCodes}
            FILTER c.deviceCode == ${deviceCode}
            RETURN c
        )
        LET clear = (
          FOR c IN code
            FILTER HAS(c, 'approved')
            REMOVE c IN ${deviceCodes}
            RETURN OLD
        )
        RETURN {
          redeemed: LENGTH(clear) == 1,
          code: FIRST(code),
        }
      `);
  return (await cursor.next())!;
}
