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

import { config } from './config.js';

import crypto from 'node:crypto';

import type {
  IssueCodeCB,
  IssueIDTokenCB,
  IssueTokenCB,
} from 'oauth2orize-openid';
import { TokenError } from 'oauth2orize';
import debug from 'debug';
import jwt from 'jsonwebtoken';

import { findByCode, save } from './db/models/code.js';
import type { DBClient as Client } from './db/models/client.js';
import type { DBUser as User } from './db/models/user.js';
import keys from './keys.js';
import { save as tokens_save } from './db/models/token.js';

const trace = debug('utils:trace');

function makeHash(length: number) {
  return crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64')
    .slice(0, length)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '');
}

// Iss is the domain of the issuer that is handing out the token
export function createIdToken(
  iss: string,
  aud: string,
  user: { id: string },
  nonce: string,
  userinfoScope: readonly string[] = []
) {
  const idToken = config.get('auth.idToken');
  trace(
    'createIdToken: creating token, kid = %s, keys.sign = %O',
    idToken.signKid,
    keys.sign
  );
  const key = keys.sign.get(idToken.signKid)!;
  const options = {
    keyid: idToken.signKid,
    algorithm: key.alg,
    expiresIn: idToken.expiresIn,
    audience: aud,
    subject: user.id,
    issuer: iss,
  };

  const payload: Record<string, unknown> = {
    iat: Date.now(),
  };

  if (nonce !== undefined) {
    payload.nonce = nonce;
  }

  const userinfo = createUserinfo(
    user as unknown as Record<string, unknown>,
    userinfoScope
  );

  if (userinfo) {
    Object.assign(payload, userinfo);
  }

  trace('createIdToken: signing payload of id token');
  const index = jwt.sign(payload, key.pem, options);
  trace('createIdToken: done signing payload of id token');

  return index;
}

function isArray(value: unknown): value is unknown[] | readonly unknown[] {
  return Array.isArray(value);
}

export async function createToken(
  scope: string | readonly string[],
  user: { id: string },
  clientId: string
) {
  const token = config.get('auth.token');
  const tok = {
    token: makeHash(token.length),
    expiresIn: token.expiresIn,
    scope: isArray(scope) ? scope : scope.split(' '),
    user,
    clientId,
  };
  trace(tok, 'createToken: about to save token');
  return tokens_save(tok);
}

export function createUserinfo(
  user: Record<string, unknown>,
  scopes: string | readonly string[]
) {
  const userinfo: Record<string, unknown> = {};

  if (scopes.includes('profile')) {
    Object.assign(userinfo, {
      sub: user.id,
      name: user.name,
      family_name: user.family_name,
      given_name: user.given_name,
      middle_name: user.middle_name,
      nickname: user.nickname,
      preferred_username: user.username,
      profile: user.profile,
      picture: user.picture,
      website: user.website,
      gender: user.gender,
      birthdate: user.birthdate,
      zoneinfo: user.zoneinfo,
      locale: user.locale,
      updated_at: user.updated_at,
    });
  }

  if (scopes.includes('email')) {
    Object.assign(userinfo, {
      sub: user.id,
      email: user.email,
      email_verified: user.email_verified,
    });
  }

  if (scopes.includes('address')) {
    Object.assign(userinfo, {
      sub: user.id,
      address: user.address,
    });
  }

  if (scopes.includes('phone')) {
    Object.assign(userinfo, {
      sub: user.id,
      phone_number: user.phone_number,
      phone_number_verified: user.phone_number_verified,
    });
  }

  if (userinfo.sub === undefined) {
    return;
  }

  return userinfo;
}

export const issueToken: IssueTokenCB = async (
  client: Client,
  user: User,
  ares,
  done
) => {
  const token = await createToken(ares.scope, user, client.client_id);
  done(null, token.token, { expires_in: token.expiresIn });
};

export const issueIdToken: IssueIDTokenCB = async (
  client: Client,
  user: User,
  ares,
  done
) => {
  // @ts-expect-error userinfo
  const userinfoScope: string[] = ares.userinfo ? ares.scope : [];

  const token = createIdToken(
    client.reqdomain!,
    client.client_id,
    user,
    // @ts-expect-error nonce
    ares.nonce,
    userinfoScope
  );
  done(null, token);
};

export const issueCode: IssueCodeCB = async (
  client: Client,
  redirectUri,
  user: User,
  ares,
  done
  // eslint-disable-next-line max-params
) => {
  const authCode = config.get('auth.code');
  const c = {
    code: makeHash(authCode.length),
    expiresIn: authCode.expiresIn,
    scope: ares.scope,
    user,
    clientId: client.client_id,
    redirectUri,
  };

  if ('nonce' in ares) {
    // @ts-expect-error nonce
    c.nonce = ares.nonce;
  }

  trace('Saving new code: %s', c.code);
  const { code } = await save(c);
  done(null, code);
};

export async function issueTokenFromCode(
  client: Client,
  c: string,
  redirectUri: string
) {
  const code = await findByCode(c);
  trace({ code }, 'issueTokenFromCode: findByCode returned');
  if (!code) {
    throw new TokenError('Invalid code', 'invalid_code');
  }

  if (code.isRedeemed()) {
    throw new TokenError('Code already redeemed', 'invalid_request');
  }

  if (code.isExpired()) {
    throw new TokenError('Code expired', 'invalid_request');
  }

  if (!code.matchesClientId(client.client_id)) {
    await code.redeem();
    throw new TokenError(
      'Client ID does not match original request',
      'invalid_client'
    );
  }

  if (!code.matchesRedirectUri(redirectUri)) {
    await code.redeem();
    throw new TokenError(
      'Redirect URI does not match original request',
      'invalid_request'
    );
  }

  const redeemed = await code.redeem();
  const { expiresIn, token } = await createToken(
    redeemed.scope,
    redeemed.user,
    redeemed.clientId
  );
  const extras: Record<string, unknown> = {
    expires_in: expiresIn,
  };

  if (redeemed.scope.includes('openid')) {
    extras.id_token = createIdToken(
      client.reqdomain!,
      redeemed.clientId,
      redeemed.user,
      redeemed.nonce!
    );
  }

  return [token, extras];
}
