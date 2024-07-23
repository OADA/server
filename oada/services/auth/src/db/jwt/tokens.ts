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

import { SignJWT, jwtVerify } from 'jose';
import debug from 'debug';

import type { ITokens, Token } from '../models/token.js';
import { JWKS, kid, privateKey } from '../../keys.js';
import type { TokenClaims } from '../../index.js';
import { config } from '../../config.js';

const tokenConfig = config.get('auth.token');

const trace = debug('arango:token:trace');

export const verify = async function (token: string, issuer: string) {
  trace('findByToken: searching for token %s', token);
  const { payload } = await jwtVerify<TokenClaims>(token, JWKS, {
    issuer,
    audience: issuer,
  });
  if (!payload) {
    throw new TypeError('Invalid token, no JWT payload');
  }

  const { _id, ...t } = payload;

  return t;
} satisfies ITokens['verify'];

export const create = async function (
  { sub, iat, exp, nbf, ...claims }: Token,
  issuer?: string,
) {
  try {
    const iss = issuer ?? claims.iss;
    if (!iss) {
      throw new TypeError('Issuer not provided');
    }

    const jwt = new SignJWT(claims)
      .setProtectedHeader({
        alg: tokenConfig.alg,
        kid,
        jku: config.get('auth.endpoints.certs'),
      })
      .setJti(randomBytes(16).toString('hex'))
      .setIssuedAt(iat)
      .setIssuer(iss)
      // ???: Should the audience be something different?
      // .setAudience(issuer)
      .setNotBefore(nbf ?? new Date());

    if (sub) {
      jwt.setSubject(sub);
    }

    if (exp) {
      jwt.setExpirationTime(exp);
    }

    return await jwt.sign(privateKey);
  } catch (error: unknown) {
    throw new Error('Failed to issue token', { cause: error });
  }
} satisfies ITokens['create'];
