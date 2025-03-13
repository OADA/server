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

import debug from "debug";

import { codes } from "@oada/lib-arangodb";

import type { ICode } from "../models/code.js";

const trace = debug("arango:codes:trace");

export async function findByCode(code: string): Promise<ICode | undefined> {
  trace("findByCode: searching for code %s", code);
  const found = await codes.findByCode(code);
  if (!found) {
    return found;
  }

  const { _id, ...c } = found;
  return { ...c, id: _id, user: c.user };
}

export async function save(code: ICode) {
  const { id, user, ...c } = code;
  return codes.save({
    ...c,
    _id: id,
    user,
  });
}
