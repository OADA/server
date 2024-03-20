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

import type { Authorization } from '../authorizations.js';

/* eslint-disable sonarjs/no-duplicate-string */

export default [
  {
    _id: 'authorizations/default:authorization-123',
    token: 'abc',
    scope: ['oada.yield:all', 'trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_frank_123' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-012',
    token: 'mike',
    scope: ['oada.fields:all', 'oada.operations:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_servio_012' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-124',
    token: 'xyz',
    scope: ['oada.rocks:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_frank2_124' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },

  {
    _id: 'authorizations/default:authorization-321',
    token: 'def',
    scope: ['oada.yield:all', 'trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_sam_321' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-god',
    token: 'god',
    scope: ['all:all', 'oada.admin.user:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_sam_321' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-god-proxy',
    token: 'god-proxy',
    scope: ['all:all', 'oada.admin.user:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_sam_321-proxy' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-654',
    token: 'yyy',
    scope: ['oada.rocks:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_sam_321' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-999',
    token: 'aaa',
    scope: ['trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_audrey_999' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-777',
    token: 'ggg',
    scope: ['trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_gary_growersync' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-444',
    token: 'ppp',
    scope: ['trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_pete_pspperfection' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-555',
    token: 'rrr',
    scope: ['trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_rick_retailfresh' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
  {
    _id: 'authorizations/default:authorization-666',
    token: 'ddd',
    scope: ['trellisfw:all'],
    createTime: 1_413_831_649_937,
    expiresIn: 0,
    user: { _id: 'users/default:users_diane_distributingexcellence' },
    clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
  },
] as const satisfies Authorization[];
