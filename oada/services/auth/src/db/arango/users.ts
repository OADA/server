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

import { users } from "@oada/lib-arangodb";
import debug from "debug";

import type { IUsers, User } from "../models/user.js";

const trace = debug("arango:user:trace");

export const findById = (async (id: string) => {
  trace("findById: searching for user %s", id);
  return users.findById(id);
}) satisfies IUsers["findById"];

export const findByUsername = (async (username: User["username"]) => {
  trace("findByUsername: searching for user %s", username);
  return users.findByUsername(username);
}) satisfies IUsers["findByUsername"];

export const findByUsernamePassword = (async (
  username: User["username"],
  password: string,
) => {
  trace("findByUsername: searching for user %s with  password", username);
  return users.findByUsernamePassword(username, password);
}) satisfies IUsers["findByUsernamePassword"];

export const findByOIDCToken = (async (token: { sub: string; iss: string }) => {
  trace(
    "findByOIDCToken: searching for oidc token sub=%s, iss=%s",
    token.sub,
    token.iss,
  );
  return users.findByOIDCToken(token);
}) satisfies IUsers["findByOIDCToken"];

export const findByOIDCUsername = (async (
  username: User["username"],
  domain: string,
) => {
  trace(
    "findByOIDCUsername: searching for oidc username %s at %d",
    username,
    domain,
  );
  return users.findByOIDCUsername(username, domain);
}) satisfies IUsers["findByOIDCUsername"];

export const update = (async (user: User) => {
  await users.update(user);
}) satisfies IUsers["update"];

export const create = (async (user: User) =>
  users.create(user)) satisfies IUsers["create"];
