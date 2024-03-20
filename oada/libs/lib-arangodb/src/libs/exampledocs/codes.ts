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

import type { Code, CodeID } from '../codes.js';
import type { UserID } from '@oada/models/user';

export default [
  {
    _id: 'codes/default:codes_xyz_123' as CodeID,
    code: 'xyz',
    scope: [],
    nonce: '',
    user: { _id: 'users/123frank' as UserID },
    createTime: 1_413_831_649_937,
    expiresIn: 60,
    redeemed: true,
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
    redirectUri: 'http://client.oada-dev.com/redirect',
  },
] as const satisfies Code[];
