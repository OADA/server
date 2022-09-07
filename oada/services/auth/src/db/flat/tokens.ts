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

import type { Token } from '../models/token.js';
// @ts-expect-error IDEK
import tokens from './tokens.json';

const database = new Map<string, Token>(Object.entries(tokens));

export function findByToken(token: string) {
  return cloneDeep(database.get(token));
}

export function save(token: Token) {
  database.set(token.token, cloneDeep(token));
  return findByToken(token.token);
}
