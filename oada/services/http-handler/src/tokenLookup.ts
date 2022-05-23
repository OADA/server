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

import { authorizations } from '@oada/lib-arangodb';

import debug from 'debug';

const trace = debug('token-lookup:trace');
const info = debug('token-lookup:info');
const warn = debug('token-lookup:warn');

export interface TokenRequest {
  token: string;
}
export interface TokenResponse {
  token?: string;
  token_exists: boolean;
  doc: {
    expired: boolean;
    authorizationid: string;
    user_id: string;
    user_scope: readonly string[];
    scope: readonly string[];
    bookmarks_id: string;
    shares_id: string;
    client_id: string;
  };
}

export default async function tokenLookup(
  request: TokenRequest
): Promise<TokenResponse> {
  const response: TokenResponse = {
    // Type: 'http_response',
    token: request.token,
    token_exists: false,
    // Partition: req.resp_partition,
    // connection_id: req.connection_id,
    doc: {
      expired: false,
      authorizationid: '',
      user_id: '',
      scope: [],
      user_scope: [],
      bookmarks_id: '',
      shares_id: '',
      client_id: '',
    },
  };

  if (typeof request.token === 'undefined') {
    trace('No token supplied with the request.');
    return response;
  }

  // Get token from db.
  // FIXME: We should speed this up by getting everything in one query.
  const t = await authorizations.findByToken(
    request.token.trim().replace(/^Bearer /, '')
  );

  if (!t) {
    warn('Token %s does not exist.', request.token);
    response.token = undefined;
    return response;
  }

  if (!t._id) {
    warn('_id for token does not exist in response');
  }

  if (!t.user) {
    throw new Error(`user for token ${t.token} not found`);
  }

  if (!t.user.bookmarks) {
    info('No bookmarks for user from token %s', t.token);
    t.user.bookmarks = { _id: '' };
  }

  let expired = false;
  if (t.expiresIn && t.createTime) {
    const now = Date.now();
    if (now > t.createTime + t.expiresIn) {
      info('Token is expired');
      expired = true;
    }

    trace(
      'token.createTime = %s, t.expiresIn = %s, now = %s',
      t.createTime,
      t.expiresIn,
      now
    );
  }

  trace('token expired? %s', expired);

  response.token_exists = true;
  trace('received authorization, _id = %s', t._id);
  response.doc.authorizationid = t._id;
  response.doc.client_id = t.clientId;
  response.doc.user_id = t.user._id || response.doc.user_id;
  response.doc.user_scope = t.user.scope;
  response.doc.bookmarks_id = t.user.bookmarks._id || response.doc.bookmarks_id;
  response.doc.shares_id = t.user.shares._id || response.doc.shares_id;
  response.doc.scope = t.scope || response.doc.scope;
  response.doc.expired = expired;

  return response;
}
