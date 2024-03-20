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

import type { User } from '../models/user.js';

// @ts-expect-error IDEK
import users from './users.json';

const database = new Map(Object.entries(users as Record<string, User>));

export function findByUsername(username: string) {
  // eslint-disable-next-line unicorn/no-null
  return cloneDeep(database.get(username)) ?? null;
}

export function findByUsernamePassword(username: string, password: string) {
  const user = database.get(username);
  // eslint-disable-next-line unicorn/no-null
  return user?.password === password ? cloneDeep(user) : null;
}
