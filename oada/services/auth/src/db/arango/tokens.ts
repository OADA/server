/**
 * @license
 * Copyright 2017-2024 Open Ag Data Alliance
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

import { authorizations } from "@oada/lib-arangodb";
import debug from "debug";

import type { ITokens, Token } from "../models/token.js";

const trace = debug("arango:token:trace");

export const verify = (async (token: string) => {
  trace("findByToken: searching for token %s", token);
  const found = await authorizations.findByToken(token);
  if (!found) {
    throw new Error("Token not found");
  }

  const {
    _id: _,
    token: t,
    clientId,
    user: {
      sub,
      // @ts-expect-error deprecated key
      _id,
      ...user
    },
    scope,
    createTime,
    expiresIn,
    ...rest
  } = found;

  return {
    jti: t,
    client_id: clientId,
    scope: scope.join(" "),
    iat: createTime,
    exp: expiresIn,
    sub: sub ?? _id,
    ...user,
    ...rest,
  };
}) satisfies ITokens["verify"];

export const create = (async ({
  jti,
  client_id,
  sub,
  scope,
  iat,
  exp,
  ...rest
}: Token) => {
  const t = {
    ...rest,
    token: jti,
    clientId: client_id!,
    user: {
      sub,
      _id: sub,
    },
    scope: scope.split(" "),
    createTime: iat,
    expiresIn: exp,
  };
  trace(t, "save: saving token");
  const { token } = await authorizations.save(t);
  return token;
}) satisfies ITokens["create"];
