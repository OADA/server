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

import type { Code } from "../models/code.js";
// @ts-expect-error IDEK
import codes from "./codes.json";

const database = new Map<string, Code>(Object.entries(codes));

export function findByCode(code: string) {
  return structuredClone(database.get(code));
}

export function save(code: Code) {
  database.set(code.code, structuredClone(code));
  return findByCode(code.code);
}
