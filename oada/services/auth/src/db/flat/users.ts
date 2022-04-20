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

import type { DBUser } from '../models/user';
// @ts-expect-error IDEK
import users from './users.json';

export function findByUsername(username: string) {
  if (users[username]) {
    return cloneDeep<DBUser>(users[username]);
  }

  return null;
}

export function findByUsernamePassword(username: string, password: string) {
  if (users[username]?.password === password) {
    return cloneDeep<DBUser>(users[username]);
  }

  return null;
}
