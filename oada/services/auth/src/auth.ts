/**
 * @license
 * Copyright 2017-2023 Open Ag Data Alliance
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

import {
  Strategy as JWTStrategy,
  type VerifyCallbackWithRequest,
} from 'passport-jwt';
import { type RSA_JWK, jwk2pem } from 'pem-jwk';
import { Authenticator } from '@fastify/passport';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import ClientPassword from 'passport-oauth2-client-password';
import { Strategy as LocalStrategy } from 'passport-local';
import debug from 'debug';
import { decodeJwt } from 'jose';

import { jwksUtils } from '@oada/certs';

import {
  type User,
  findByUsernamePassword,
  findById as findUserById,
} from './db/models/user.js';
import { _defaultHack } from './index.js';
import { findById } from './db/models/client.js';
import { findByToken } from './db/models/token.js';

export const fastifyPassport = new Authenticator({
  clearSessionOnLogin: process.env.NODE_ENV === 'development',
  clearSessionIgnoreFields: ['returnTo'],
});

const trace = debug('auth#auth:trace');
const warn = debug('auth#auth:warn');

declare module 'fastify' {
  interface PassportUser extends User {}
}

// LocalStrategy is used for the /login screen
fastifyPassport.use(
  'local',
  new LocalStrategy(async (username, password, done) => {
    trace('Looking up username %s in local strategy', username);
    try {
      const user = await findByUsernamePassword(username, password);
      if (!user) {
        // eslint-disable-next-line unicorn/no-null
        done(null, false);
        return;
      }

      // eslint-disable-next-line unicorn/no-null
      done(null, user);
    } catch (error: unknown) {
      done(error);
    }
  }),
);

fastifyPassport.registerUserSerializer<User, string>(async (user) => {
  trace('Serializing user by _id as %s', user.id);
  if (!user.id) {
    throw new TypeError('User has no id');
  }

  return user.id;
});

fastifyPassport.registerUserDeserializer<string, User>(async (userid) => {
  trace('deserializing user by userid: %s', userid);
  const user = await findUserById(userid);
  if (!user) {
    throw new Error(`User not found for id: ${userid}`);
  }

  return user;
});

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7523}
 */
fastifyPassport.use(
  'oauth2-client-assertion',
  new JWTStrategy(
    {
      passReqToCallback: true,
      jwtFromRequest({ body }) {
        // @ts-expect-error stuff
        const { client_assertion_type, client_assertion } = body ?? {};
        if (
          client_assertion_type !==
          'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
        ) {
          trace('Unknown client_assertion_type %s', client_assertion_type);
          // eslint-disable-next-line unicorn/no-null
          return null;
        }

        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return client_assertion;
      },
      async secretOrKeyProvider(_request, jwt, done) {
        try {
          const payload = decodeJwt(`${jwt}`);

          /**
           * Subject of the JWT **MUST** be the client_id
           * @see {@link https://datatracker.ietf.org/doc/html/rfc7523#section-3}
           */
          const clientId = payload?.sub;
          const client = await findById(clientId!);
          if (!client) {
            warn('Failed to find client by id %s', clientId);
            throw new Error(`Client ${clientId} not found`);
          }

          // Fetch associated JWK
          const hint =
            client.jwks_uri ?? (client.jwks as unknown as jwksUtils.JWKs);
          const jwk = await jwksUtils.jwkForSignature(`${jwt}`, hint);

          // Convert JWK to PEM
          const key = jwk.kty === 'PEM' ? jwk.pem : jwk2pem(jwk as RSA_JWK);
          // eslint-disable-next-line unicorn/no-null
          done(null, key);
        } catch (error: unknown) {
          warn({ error }, 'Failed to get secretOrKeyProvider');
          // eslint-disable-next-line unicorn/no-null
          done(null);
        }
      },
    },
    (async (request, payload, done) => {
      try {
        // Check audience
        if (request.url !== payload.aud) {
          trace(
            `Audience ${payload.aud} does not match endpoint url ${request.url}`,
          );
          // eslint-disable-next-line unicorn/no-null
          done(null);
        }

        /**
         * Subject of the JWT **MUST** be the client_id
         * @see {@link https://datatracker.ietf.org/doc/html/rfc7523#section-3}
         */
        const clientId = payload?.sub as string | undefined;
        const client = await findById(clientId!);
        // eslint-disable-next-line unicorn/no-null
        done(null, client);
      } catch (error: unknown) {
        done(error);
      }
    }) as VerifyCallbackWithRequest,
  ),
);

// ClientPassword used to verify client secret in Authorization flow
fastifyPassport.use(
  'oauth2-client-password',
  new ClientPassword.Strategy(async (clientId, clientSecret, done) => {
    try {
      const client = await findById(clientId);
      if (!client) {
        // eslint-disable-next-line unicorn/no-null
        done(null, false);
        return;
      }

      if (!client.client_secret) {
        // eslint-disable-next-line unicorn/no-null
        done(null, false);
      }

      if (client.client_secret !== clientSecret) {
        throw new Error("Client secret doesn't match");
      }

      if (
        client.client_secret_expires_at &&
        client.client_secret_expires_at < Date.now()
      ) {
        throw new Error('Client secret has expired');
      }

      // eslint-disable-next-line unicorn/no-null
      done(null, client);
    } catch (error: unknown) {
      done(error);
    }
  }),
);

// BearerStrategy used to protect userinfo endpoint
fastifyPassport.use(
  'bearer',
  new BearerStrategy(async (token, done) => {
    try {
      const t = await findByToken(token);
      if (!t) {
        // eslint-disable-next-line unicorn/no-null
        done(null, false);
        return;
      }

      // eslint-disable-next-line unicorn/no-null
      done(null, t.user, { scope: t.scope.slice() });
    } catch (error: unknown) {
      done(error);
    }
  }),
);
