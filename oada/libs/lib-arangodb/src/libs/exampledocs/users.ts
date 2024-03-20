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

import type { User, UserID } from '@oada/models/user';

export default [
  {
    _id: 'users/default:users_frank_123' as UserID,
    username: 'frank',
    password: 'test',
    domain: 'localhost',
    name: 'Farmer Frank',
    family_name: 'Frank',
    given_name: 'Farmer',
    middle_name: '',
    nickname: 'Frankie',
    email: 'frank@openag.io',
    bookmarks: { _id: 'resources/default:resources_bookmarks_123' },
    shares: { _id: 'resources/default:resources_shares_123' },
    roles: [],
  },
  /*
  {
    '_id': 'users/default:users_frank2_124' as UserID,
    'domain': 'localhost',
    'username': 'dummy_username_oidc_user_frank2',
    'oidc': {
      'sub': 'users/default:users_gary_growersync', // can login as Frank at growersync.trellisfw.io
      'iss': 'api.growersync.trellisfw.io', // iss = issuer
    },
    'name': 'Gary Grower 2',
    'family_name': 'Gary2',
    'given_name': 'Grower2',
    'middle_name': '',
    'nickname': 'Gary2',
    'email': 'gary@openag.io',
    'bookmarks': {'_id': 'resources/default:resources_bookmarks_124'},
    'shares': {'_id': 'resources/default:resources_shares_124'},
  },
*/
  {
    _id: 'users/default:users_sam_321' as UserID,
    username: 'sam',
    password: 'test',
    domain: 'localhost',
    name: 'Student Sam',
    family_name: 'Student',
    given_name: 'Sam',
    middle_name: '',
    nickname: 'Sammy',
    email: 'sam@openag.io',
    bookmarks: { _id: 'resources/default:resources_bookmarks_321' },
    shares: { _id: 'resources/default:resources_shares_321' },
    roles: ['oada.admin.user:all'],
    oidc: undefined,
  },
  {
    _id: 'users/default:users_sam_321-proxy' as UserID,
    username: 'sam-proxy',
    password: 'test',
    domain: 'proxy',
    name: 'Sam Proxy',
    family_name: 'Proxy',
    given_name: 'Sam',
    middle_name: '',
    nickname: 'Sammy',
    email: 'sam@openag.io',
    bookmarks: { _id: 'resources/default:resources_bookmarks_321-proxy' },
    shares: { _id: 'resources/default:resources_shares_321-proxy' },
    roles: ['oada.admin.user:all'],
    oidc: undefined,
  },
  {
    _id: 'users/default:users_audrey_999' as UserID,
    username: 'audrey',
    password: 'test',
    domain: 'abcaudits.trellisfw.io',
    name: 'Auditor Audrey',
    family_name: 'Auditor',
    given_name: 'Audrey',
    middle_name: '',
    nickname: 'Audinator',
    email: 'audrey@openag.io',
    bookmarks: { _id: 'resources/default:resources_bookmarks_999' },
    shares: { _id: 'resources/default:resources_shares_999' },
    oidc: undefined,
    roles: [],
  },
  {
    _id: 'users/default:users_gary_growersync' as UserID,
    username: 'gary@gmail.com',
    password: 'test',
    domain: 'growersync.trellisfw.io',
    name: 'Grower Gary',
    family_name: 'Grower',
    given_name: 'Gary',
    middle_name: '',
    nickname: 'G-Man',
    email: 'gary@gmail.com',
    bookmarks: { _id: 'resources/default:resources_bookmarks_777' },
    shares: { _id: 'resources/default:resources_shares_777' },
    oidc: undefined,
    roles: [],
  },
  {
    _id: 'users/default:users_pete_pspperfection' as UserID,
    username: 'pete@gmail.com',
    password: 'test',
    domain: 'pspperfection.trellisfw.io',
    name: 'Packer Pete',
    family_name: 'Packer',
    given_name: 'Pete',
    middle_name: '',
    nickname: 'Peter Piper',
    email: 'pete@gmail.com',
    bookmarks: { _id: 'resources/default:resources_bookmarks_444' },
    shares: { _id: 'resources/default:resources_shares_444' },
    oidc: undefined,
    roles: [],
  },
  {
    _id: 'users/default:users_rick_retailfresh' as UserID,
    username: 'rick@gmail.com',
    password: 'test',
    domain: 'retailfresh.trellisfw.io',
    name: 'Retailer Rick',
    family_name: 'Retailer',
    given_name: 'Rick',
    middle_name: '',
    nickname: 'Retail King',
    email: 'rick@gmail.com',
    bookmarks: { _id: 'resources/default:resources_bookmarks_555' },
    shares: { _id: 'resources/default:resources_shares_555' },
    oidc: undefined,
    roles: [],
  },
  {
    _id: 'users/default:users_diane_distributingexcellence' as UserID,
    username: 'diane@gmail.com',
    password: 'test',
    domain: 'distributingexcellence.trellisfw.io',
    name: 'Distributor Diane',
    family_name: 'Distributor',
    given_name: 'Diane',
    middle_name: '',
    nickname: 'The Distribunator',
    email: 'diane@gmail.com',
    bookmarks: { _id: 'resources/default:resources_bookmarks_666' },
    shares: { _id: 'resources/default:resources_shares_666' },
    oidc: undefined,
    roles: [],
  },
] as const satisfies User[];
