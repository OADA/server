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

var trace = require('debug')('trace:auth.js');
var info = require('debug')('info:auth.js');
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
    trace('#ClientPassword.Strategy: looking for code ', req.body.code);
    codes.findByCode(req.body.code, function(err, code) {
      if (err) {
        info('#ClientPassword.Strategy: code not found');
        return done(new AuthorizationError('Code not found',
              'invalid_request'));
      }

      if (code.isRedeemed()) {
        info('#ClientPassword.Strategy: code ',req.body.code,' is already redeemed');
        return done(null, false);
      }

      trace('#ClientPassword.Strategy: found code, searching for clientid from that code: ',code.clientId);
      clients.findById(code.clientId, function(err, client) {
        if (err) { 
          info('#ClientPassword.Strategy: failed to find client by id ',code.clientId,'.  err = ', err); 
          return done(err); 
        }

        var key_hint = client.jwks_uri || client.jwks;

        // Have to compute this from req now that we have multi-domain.
        // Could also verify that req.host matches one of the possible
        // domains to prevent someone spoofing a different domain?
        var tokenEndpoint = URI({
          protocol: req.protocol,    // http or https
          hostname: req.get('host'), // includes port if available
          path: req.originalUrl,     // does not include query parameters
        }).normalize().toString();

        trace('#ClientPassword.Strategy: verifying jwt, tokenEndpoint = ', tokenEndpoint);
        jwtBearerClientAuth.verify(
          cSecret,       // arg0: client secret
          key_hint,      // arg1: jwks_uri or jwks (i.e. public key or where to find public key)
          cId,           // arg2: issuer ID: simplest to just make the same as clientID,
          cId,           // arg3: clientID: used in the `sub` claim
          tokenEndpoint, // arg4: tokenEndpoint (i.e. the `aud` (audience) field from JWT)
          {},            // arg5: options
          function(err, valid) { // arg6: callback
            if (err) {
              info('#ClientPassword.Strategy: jwtBearerClientAuth.verify returned an error.  err = ', err);
              return done(err);
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
  }));

// BearerStrategy used to protect userinfo endpoint
passport.use(new BearerStrategy(function(token, done) {
  tokens.findByToken(token, function(err, t) {
    if (err) { return done(err); }
    if (!t) { return done(null, false); }

    done(null, t.user, {scope: t.scope});
  });
}));
