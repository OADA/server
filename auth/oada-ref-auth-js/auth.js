/* Copyright 2014 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var passport = require('passport');
var LocalStrategy = require('passport-local');
var ClientPassword = require('passport-oauth2-client-password');
var BearerStrategy = require('passport-http-bearer').Strategy;
var AuthorizationError = require('oauth2orize').AuthorizationError;

var URI = require('URIjs');

var oadaLookup = require('oada-lookup');
var jwtBearerClientAuth = require('jwt-bearer-client-auth');

var config = require('./config');

var clients = require('./db/models/client');
var users = require('./db/models/user');
var codes = require('./db/models/code');
var tokens = require('./db/models/token');

// LocalStrategy is used for the /login screen
passport.use(new LocalStrategy.Strategy(function(username, password, done) {
  users.findByUsernamePassword(username, password, function(err, user) {
    if (err) { return done(err); }
    if (!user) { return done(null, false); }

    return done(null, user);
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user.username);
});

passport.deserializeUser(function(username, done) {
  users.findByUsername(username, function(err, user) {
    done(err, user);
  });
});

// ClientPassword used to verify client secret in Authroization flow
passport.use(new ClientPassword.Strategy({
    passReqToCallback: true
  },
  function(req, cId, cSecret, done) {
    codes.findByCode(req.body.code, function(err, code) {
      if (err) {
        return done(new AuthorizationError('Code not found',
              'invalid_request'));
      }

      if (code.isRedeemed()) {
        return done(null, false);
      }

      clients.findById(code.clientId, function(err, client) {
        if (err) { return done(err); }

        var key_hint = client.jwks_uri || client.jwks;

        jwtBearerClientAuth.verify(cSecret, key_hint, cId, cId,
          URI(config.get('auth:server:publicUri') + config.get('auth:endpoints:token'))
            .normalize()
            .toString(), {},
          function(err, valid) {
            if (err) {
              if(err.name === 'JsonWebTokenError') {
                return done(null, err);
              } else {
                return done(err);
              }
            }

            if (!valid) {
              return done(null, valid);
            }

            clients.findById(code.clientId, function(err, client) {
              if (err) { return done(err); }

              done(null, client);
            });
          });
      });
    });
  }));

// BearerStrategy used to protect userinfo endpoint
passport.use(new BearerStrategy(function(token, done) {
  tokens.findByToken(token, function(err, t) {
    if (err) { return done(err); }
    if (!t) { return done(null, false); }

    done(null, t.user, {scope: t.scope});
  });
}));
