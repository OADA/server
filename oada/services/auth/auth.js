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

'use strict';

const trace = require('debug')('auth#auth:trace');
const info = require('debug')('auth#auth:info');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const ClientPassword = require('passport-oauth2-client-password');
const BearerStrategy = require('passport-http-bearer').Strategy;
const { AuthorizationError } = require('oauth2orize');

const URI = require('urijs');

const jwtBearerClientAuth = require('jwt-bearer-client-auth');

const clients = require('./db/models/client');
const users = require('./db/models/user');
const codes = require('./db/models/code');
const tokens = require('./db/models/token');

// LocalStrategy is used for the /login screen
passport.use(
  new LocalStrategy.Strategy((username, password, done) => {
    trace(`Looking up username ${username} in local strategy`);
    return users.findByUsernamePassword(username, password, (error, user) => {
      if (error) {
        return done(error);
      }

      if (!user) {
        return done(null, false);
      }

      return done(null, user);
    });
  })
);

passport.serializeUser((user, done) => {
  trace('serializing user by _id as %s', user._id);
  //  Done(null, user.username);
  done(null, user._id);
});

passport.deserializeUser((userid, done) => {
  //  Users.findByUsername(username, function(err, user) {
  trace('deserializing user by userid: %s', userid);
  users.findById(userid, (error, user) => {
    done(error, user);
  });
});

// ClientPassword used to verify client secret in Authroization flow
passport.use(
  new ClientPassword.Strategy(
    {
      passReqToCallback: true,
    },
    (request, cId, cSecret, done) => {
      trace('#ClientPassword.Strategy: looking for code %s', request.body.code);
      codes.findByCode(request.body.code, (error, code) => {
        if (error) {
          info('#ClientPassword.Strategy: code not found');
          return done(
            new AuthorizationError('Code not found', 'invalid_request')
          );
        }

        if (code.isRedeemed()) {
          info(
            '#ClientPassword.Strategy: code %s is already redeemed',
            request.body.code
          );
          return done(null, false);
        }

        trace(
          '#ClientPassword.Strategy: found code, searching for clientid from that code: %s',
          code.clientId
        );
        clients.findById(code.clientId, (error, client) => {
          if (error) {
            info(
              '#ClientPassword.Strategy: failed to find client by id %s. err = %O',
              code.clientId,
              error
            );
            return done(error);
          }

          const key_hint = client.jwks_uri || client.jwks;

          // Have to compute this from req now that we have multi-domain.
          // Could also verify that req.host matches one of the possible
          // domains to prevent someone spoofing a different domain?
          const tokenEndpoint = URI({
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
          jwtBearerClientAuth.verify(
            cSecret, // Arg0: client secret
            key_hint, // Arg1: jwks_uri or jwks (i.e. public key or where to find public key)
            cId, // Arg2: issuer ID: simplest to just make the same as clientID,
            cId, // Arg3: clientID: used in the `sub` claim
            tokenEndpoint, // Arg4: tokenEndpoint (i.e. the `aud` (audience) field from JWT)
            {}, // Arg5: options
            (error, valid) => {
              // Arg6: callback
              if (error) {
                info(
                  '#ClientPassword.Strategy: jwtBearerClientAuth.verify returned an error.  err = %O',
                  error
                );
                return done(error);
              }

              if (!valid) {
                return done(null, valid);
              }

              trace('#ClientPassword.Strategy: client is valid, returning');
              return done(null, client);
            }
          );
        });
      });
    }
  )
);

// BearerStrategy used to protect userinfo endpoint
passport.use(
  new BearerStrategy((token, done) => {
    tokens.findByToken(token, (error, t) => {
      if (error) {
        return done(error);
      }

      if (!t) {
        return done(null, false);
      }

      done(null, t.user, { scope: t.scope });
    });
  })
);
