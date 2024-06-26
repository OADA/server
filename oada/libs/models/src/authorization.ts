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

import type { Opaque } from 'type-fest';
import { destructure } from './decorators.js';

export type AuthorizationID = Opaque<string, Authorization>;

/**
 * Our representation of an Authorization (e.g., an OAuth2.0 bearer token)
 * and associated information
 */
export
@destructure
class Authorization {
  constructor(authorization?: Partial<Authorization>);

  // eslint-disable-next-line max-params
  constructor(
    _: Partial<Authorization> = {},
    /**
     * The user associated with this authorization
     */
    readonly user?: { _id: string },
    /**
     * The API client which requested this authorization
     */
    readonly client?: { client_id: string },
    // Readonly _id = `authorizations/${generate()}` as AuthorizationID,
    readonly token = '',
    readonly scope = '',
    readonly createTime = Date.now() / 1000,
    readonly expiresIn = 0,
    readonly revoked?: boolean,
  ) {}
}

export default Authorization;
