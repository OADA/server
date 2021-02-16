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

var URI = require('urijs');
var login = require('connect-ensure-login');
var oauth2orize = require('oauth2orize');
var AuthorizationError = require('oauth2orize').AuthorizationError;
var passport = require('passport');
var debug = require('debug')('oauth2:trace');
var _ = require('lodash');
var fs = require('fs');

var oadaLookup = require('@oada/oada-lookup');

var utils = require('./utils');
var clients = require('./db/models/client');

var server;
module.exports = function (_server, config) {
  //-----------------------------------------------------------------------
  // Load all the domain configs at startup
  const ddir = config.get('domainsDir');
  const domainConfigs = _.keyBy(
    _.map(fs.readdirSync(ddir), (dirname) => {
      if (dirname.startsWith('.') == false)
        return require(ddir + '/' + dirname + '/config');
    }),
    'domain'
  );

  server = _server;

  // Implict flow (token)
  server.grant(oauth2orize.grant.token(utils.issueToken));

  // Code flow (code)
  server.grant(oauth2orize.grant.code(utils.issueCode));

  // Code flow exchange (code)
  server.exchange(oauth2orize.exchange.code(utils.issueTokenFromCode));

  // If the array of scopes contains ONLY openid OR openid and profile, auto-accept.
  // Better to handle this by asking only the first time, but this is quicker to get PoC working.
  function scopeIsOnlyOpenid(scopes) {
    if (!scopes) return false;
    if (scopes.length === 1 && scopes[0] === 'openid') return true;
    if (
      scopes.length === 2 &&
      _.includes(scopes, 'openid') &&
      _.includes(scopes, 'profile')
    )
      return true;
    return false;
  }

  //////
  // Middleware
  //////
  return {
    authorize: [
      // If the redirecting domain sets the "domain_hint", save it in the session so that the login page
      // can fill it in as the default choice:
      function (req, _res, next) {
        debug('oauth2#authorize: checking for domain_hint');
        if (req && req.query && req.query.domain_hint) {
          req.session.domain_hint = req.query.domain_hint;
        }
        next();
      },
      // can access it to pre-fill the domain box
      // ensureLoggedIn fills in req.session.returnTo to let you redirect
      // back after logging in
      login.ensureLoggedIn(config.get('auth:endpoints:login')),
      server.authorization(function (clientId, redirectURI, done) {
        clients.findById(clientId, function (err, client) {
          if (err) {
            return done(err);
          }
          if (!client) {
            return done(null, false);
          }

          // Compare the given redirectUrl to all the clients redirectUrls
          for (var i = 0; i < client['redirect_uris'].length; i++) {
            if (URI(client['redirect_uris'][i]).equals(redirectURI)) {
              return done(null, client, redirectURI);
            }
          }
          debug(
            'oauth2#authorize: redirect_uri from URL (' +
              redirectURI +
              ') does not match any on client cert: ',
            client.redirect_uris
          );
          return done(null, false);
        });
      }),
      function (req, res) {
        oadaLookup.trustedCDP(function () {
          // Load the login info for this domain from the public directory:
          const domain_config =
            domainConfigs[req.hostname] || domainConfigs.localhost;
          res.render(config.get('auth:views:approvePage'), {
            transactionID: req.oauth2.transactionID,
            client: req.oauth2.client,
            scope: req.oauth2.req.scope,
            nonce: req.oauth2.req.nonce,
            trusted: req.oauth2.client.trusted,
            decision_url: config.get('auth:endpoints:decision'),
            user: {
              name: req.user && req.user.name ? req.user.name : '',
              username:
                req.user && req.user.username ? req.user.username : 'nobody',
            },
            autoaccept: scopeIsOnlyOpenid(req.oauth2.req.scope) ? true : false,
            logout: config.get('auth:endpoints:logout'),
            name: domain_config.name,
            logo_url:
              config.get('auth:endpointsPrefix') +
              '/domains/' +
              domain_config.domain +
              '/' +
              domain_config.logo,
            tagline: domain_config.tagline,
            color: domain_config.color || '#FFFFFF',
          });
        });
      },
      server.errorHandler({ mode: 'indirect' }),
    ],
    decision: [
      function (_req, _res, next) {
        debug('oauth2#decision: Received decision POST from form');
        next();
      },
      login.ensureLoggedIn(config.get('auth:endpoints:login')),
      server.decision(function parseDecision(req, done) {
        var validScope = req.body.scope.every(function (el) {
          return req.oauth2.req.scope.indexOf(el) != -1;
        });

        if (!validScope) {
          return done(
            new AuthorizationError(
              'Scope does not match orignal ' + 'request',
              'invalid_scope'
            )
          );
        }

        debug(
          'decision: allow = ',
          req.allow,
          ', scope = ',
          req.body.scope,
          ', nonce = ',
          req.oauth2.req.nonce
        );
        done(null, {
          allow: req.allow,
          scope: req.body.scope,
          nonce: req.oauth2.req.nonce,
        });
      }),
      server.errorHandler({ mode: 'indirect' }),
    ],
    token: [
      function (req, _res, next) {
        // have to keep req.hostname in res to hack around oauth2orize so that issuer can be checked in openidconnect
        debug('oauth2#token: setting client_secret = client_assertion');
        // todo: hack to use passport-oauth2-client-password
        req.body['client_secret'] = req.body['client_assertion'];

        return next();
      },
      passport.authenticate(['oauth2-client-password'], { session: false }),
      function (req, _res, next) {
        if (!req.user) {
          debug(
            'oauth2#token: there is no req.user after passport.authenticate should have put the client there.'
          );
          next();
        }
        const domain_cfg = domainConfigs[req.hostname] || {
          baseuri: 'https://localhost/',
        };
        req.user.reqdomain = domain_cfg.baseuri;
        next();
      },
      server.token(),
      server.errorHandler({ mode: 'direct' }),
    ],
  };
};
