/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
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

import { randomBytes } from 'node:crypto';

import type { OmitIndexSignature, Opaque } from 'type-fest';
import type { JWTPayload } from 'jose';

import { makeClass } from '@qlever-llc/interface2class';

import type { Claims } from './oidc.js';
import { destructure } from './decorators.js';

export type AuthorizationID = Opaque<string, Authorization>;

/**
 * Our representation of an Authorization (e.g., an OAuth2.0 bearer token)
 * and associated information
 */
export
@destructure
class Authorization extends makeClass<
  OmitIndexSignature<JWTPayload & Claims>
>() {
  // @ts-expect-error HACK
  constructor(authorization?: Partial<Authorization>);

  constructor(
    rest: Partial<Authorization> = {},
    override readonly sub: string,
    override readonly jti = randomBytes(16).toString('hex'),
    // Readonly _id = `authorizations/${generate()}` as AuthorizationID,
    override readonly scope = '',
    override readonly roles: readonly string[] = [],
    override readonly iat = Date.now() / 1000,
    // TODO: Config for default expiration?
    override readonly exp = Number.MAX_VALUE,
    readonly revoked?: boolean,
  ) {
    super({ sub, ...rest });
  }
}

export default Authorization;
