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

import { AuthorizationError } from 'oauth2orize';
import { Strategy as BearerStrategy } from 'passport-http-bearer';
import ClientPassword from 'passport-oauth2-client-password';
import { Strategy as LocalStrategy } from 'passport-local';
import debug from 'debug';
import passport from 'passport';

import URI from 'urijs';

import type { jwksUtils } from '@oada/certs';
import jwtBearerClientAuth from 'jwt-bearer-client-auth';

import {
  findByUsernamePassword,
  findById as findUserById,
} from './db/models/user.js';
import { findByCode } from './db/models/code.js';
import { findById } from './db/models/client.js';
import { findByToken } from './db/models/token.js';

const trace = debug('auth#auth:trace');
const info = debug('auth#auth:info');

// LocalStrategy is used for the /login screen
passport.use(
  new LocalStrategy(async (username, password, done) => {
    trace('Looking up username %s in local strategy', username);
    try {
      const user = await findByUsernamePassword(username, password);
      if (!user) {
        done(null, false);
        return;
      }

      done(null, user);
    } catch (error: unknown) {
      done(error);
    }
  })
);

passport.serializeUser((user, done) => {
  // @ts-expect-error IDEK
  trace('Serializing user by _id as %s', user.id);
  // @ts-expect-error IDEK
  done(null, user.id);
});

passport.deserializeUser(async (userid: string, done) => {
  trace('deserializing user by userid: %s', userid);
  try {
    const user = await findUserById(userid);
    done(null, user);
  } catch (error: unknown) {
    done(error);
  }
});

// ClientPassword used to verify client secret in Authorization flow
passport.use(
  new ClientPassword.Strategy(
    {
      passReqToCallback: true,
    },
    async (request, cId, cSecret, done) => {
      trace('#ClientPassword.Strategy: looking for code %s', request.body.code);
      try {
        const code = await findByCode(request.body.code);
        if (!code) {
          info('#ClientPassword.Strategy: code not found');
          throw new AuthorizationError('Code not found', 'invalid_request');
        }

        if (code.isRedeemed()) {
          info(
            '#ClientPassword.Strategy: code %s is already redeemed',
            request.body.code
          );
          done(null, false);
          return;
        }

        trace(
          '#ClientPassword.Strategy: found code, searching for clientId from that code: %s',
          code.clientId
        );
        const client = await findById(code.clientId);
        if (!client) {
          info(
            '#ClientPassword.Strategy: failed to find client by id %s',
            code.clientId
          );
          throw new Error('Client not found');
        }

        const keyHint =
          client.jwks_uri ?? (client.jwks as unknown as jwksUtils.JWKs);

        // Have to compute this from req now that we have multi-domain.
        // Could also verify that req.host matches one of the possible
        // domains to prevent someone spoofing a different domain?
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        const tokenEndpoint = new URI({
          protocol: request.protocol, // Http or https
          hostname: request.get('host'), // Includes port if available
          path: request.originalUrl, // Does not include query parameters
        })
          .normalize()
          .toString();

        trace(
          '#ClientPassword.Strategy: verifying jwt, tokenEndpoint = %s',
          tokenEndpoint
        );
        const valid = await jwtBearerClientAuth.verify({
          token: cSecret, // Arg0: client secret
          hint: keyHint, // Arg1: jwks_uri or jwks (i.e. public key or where to find public key)
          issuer: cId, // Arg2: issuer ID: simplest to just make the same as clientID,
          clientId: cId, // Arg3: clientID: used in the `sub` claim
          tokenEndpoint, // Arg4: tokenEndpoint (i.e. the `aud` (audience) field from JWT)
        });
        if (!valid) {
          done(null, valid);
          return;
        }

        trace('#ClientPassword.Strategy: client is valid, returning');
        done(null, client);
      } catch (error: unknown) {
        done(error);
      }
    }
  )
);

// BearerStrategy used to protect userinfo endpoint
passport.use(
  new BearerStrategy(async (token, done) => {
    try {
      const t = await findByToken(token);
      if (!t) {
        done(null, false);
        return;
      }

      done(null, t.user, { scope: t.scope.slice() });
    } catch (error: unknown) {
      done(error);
    }
  })
);
