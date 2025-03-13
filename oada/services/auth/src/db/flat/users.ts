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

import type { IUsers, User } from "../models/user.js";

// @ts-expect-error IDEK
import users from "./users.json";

const database = new Map(Object.entries(users as Record<string, User>));

export const findByUsername = ((username: string) =>
  structuredClone(database.get(username)) ??
  undefined) satisfies IUsers["findByUsername"];

export const findByUsernamePassword = ((username: string, password: string) => {
  const user = database.get(username);
  return user?.password === password ? structuredClone(user) : undefined;
}) satisfies IUsers["findByUsernamePassword"];
