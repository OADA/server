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

import debug from 'debug';

import { deviceCodes } from '@oada/lib-arangodb';

import type { DeviceCode, IDeviceCodes } from '../models/deviceCode.js';

const trace = debug('arango:deviceCodes:trace');

export const findByDeviceCode = async function (deviceCode) {
  trace('findByCode: searching for code %s', deviceCode);
  const found = await deviceCodes.findByDeviceCode(deviceCode);
  if (!found) {
    return found;
  }

  const { _id, _key, ...c } = found;
  return c;
} satisfies IDeviceCodes['findByDeviceCode'];

export const findByUserCode = async function (userCode) {
  trace('findByCode: searching for code %s', userCode);
  const found = await deviceCodes.findByUserCode(userCode);
  if (!found) {
    return found;
  }

  const { _id, _key, ...c } = found;
  return c;
} satisfies IDeviceCodes['findByUserCode'];

export const save = async function <C extends DeviceCode>(deviceCode: C) {
  return (await deviceCodes.save(deviceCode)) as C;
} satisfies IDeviceCodes['save'];

export const remove = async function (deviceCode) {
  return deviceCodes.remove(deviceCode) as unknown as Promise<
    DeviceCode | undefined
  >;
} satisfies IDeviceCodes['remove'];
