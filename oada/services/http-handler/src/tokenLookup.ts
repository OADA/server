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

import { authorizations } from "@oada/lib-arangodb";
import Authorization from "@oada/models/authorization";
import debug from "debug";

const warn = debug("token-lookup:warn");

export interface TokenRequest {
  token: string;
}

export default async function tokenLookup(
  request: TokenRequest,
): Promise<Authorization | undefined> {
  // Get token from db.
  // FIXME: We should speed this up by getting everything in one query.
  const found = await authorizations.findByToken(
    request.token.trim().replace(/^Bearer /, ""),
  );

  if (!found) {
    warn("Token %s does not exist.", request.token);
    return;
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

  return new Authorization({
    jti: t,
    client_id: clientId,
    scope: Array.isArray(scope) ? scope.join(" ") : `${scope}`,
    iat: createTime,
    exp: expiresIn,
    sub: sub ?? _id,
    ...user,
    ...rest,
  });
}
