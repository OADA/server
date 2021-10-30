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

const fs = require('fs');
const { join } = require('path');

const URI = require('urijs');
const login = require('connect-ensure-login');
const oauth2orize = require('oauth2orize');
const { AuthorizationError } = require('oauth2orize');
const passport = require('passport');
const debug = require('debug')('oauth2:trace');

const oadaLookup = require('@oada/oada-lookup');

const utils = require('./utils');
const clients = require('./db/models/client');

let server;
module.exports = function (_server, config) {
  // -----------------------------------------------------------------------
  // Load all the domain configs at startup
  const ddir = config.get('domainsDir');
  const domainConfigs = fs.readdirSync(ddir).reduce((accumulator, dirname) => {
    if (!dirname.startsWith('.')) {
      const fname = join(ddir, dirname, 'config');
      // Should be safe because fname is from "admin" input not "user" input
      const config = require(fname); // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
      accumulator[config.domain] = config;
    }

    return accumulator;
  }, {});

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
      scopes.includes('openid') &&
      scopes.includes('profile')
    )
      return true;
    return false;
  }

  /// ///
  // Middleware
  /// ///
  return {
    authorize: [
      // If the redirecting domain sets the "domain_hint", save it in the session so that the login page
      // can fill it in as the default choice:
      function (request, _res, next) {
        debug('oauth2#authorize: checking for domain_hint');
        if (request && request.query && request.query.domain_hint) {
          request.session.domain_hint = request.query.domain_hint;
        }

        next();
      },
      // Can access it to pre-fill the domain box
      // ensureLoggedIn fills in req.session.returnTo to let you redirect
      // back after logging in
      login.ensureLoggedIn(config.get('auth.endpoints.login')),
      server.authorization((clientId, redirectURI, done) => {
        clients.findById(clientId, (error, client) => {
          if (error) {
            return done(error);
          }

          if (!client) {
            return done(null, false);
          }

          // Compare the given redirectUrl to all the clients redirectUrls
          for (let index = 0; index < client.redirect_uris.length; index++) {
            if (URI(client.redirect_uris[index]).equals(redirectURI)) {
              return done(null, client, redirectURI);
            }
          }

          debug(
            `oauth2#authorize: redirect_uri from URL (${redirectURI}) does not match any on client cert: %O`,
            client.redirect_uris
          );
          return done(null, false);
        });
      }),
      function (request, res) {
        oadaLookup.trustedCDP(() => {
          // Load the login info for this domain from the public directory:
          const domain_config =
            domainConfigs[request.hostname] || domainConfigs.localhost;
          res.render(config.get('auth.views.approvePage'), {
            transactionID: request.oauth2.transactionID,
            client: request.oauth2.client,
            scope: request.oauth2.req.scope,
            nonce: request.oauth2.req.nonce,
            trusted: request.oauth2.client.trusted,
            decision_url: config.get('auth.endpoints.decision'),
            user: {
              name: request.user && request.user.name ? request.user.name : '',
              username:
                request.user && request.user.username
                  ? request.user.username
                  : 'nobody',
            },
            autoaccept: Boolean(scopeIsOnlyOpenid(request.oauth2.req.scope)),
            logout: config.get('auth.endpoints.logout'),
            name: domain_config.name,
            logo_url: `${config.get('auth.endpointsPrefix')}/domains/${
              domain_config.domain
            }/${domain_config.logo}`,
            tagline: domain_config.tagline,
            color: domain_config.color || '#FFFFFF',
          });
        });
      },
      server.errorHandler({ mode: 'indirect' }),
    ],
    decision: [
      function (_request, _res, next) {
        debug('oauth2#decision: Received decision POST from form');
        next();
      },
      login.ensureLoggedIn(config.get('auth.endpoints.login')),
      server.decision(function parseDecision(request, done) {
        const validScope = request.body.scope.every((element) =>
          request.oauth2.req.scope.includes(element)
        );

        if (!validScope) {
          return done(
            new AuthorizationError(
              'Scope does not match orignal ' + 'request',
              'invalid_scope'
            )
          );
        }

        debug(
          `decision: allow = ${request.allow}, scope = ${request.body.scope}, nonce = ${request.oauth2.req.nonce}`
        );
        done(null, {
          allow: request.allow,
          scope: request.body.scope,
          nonce: request.oauth2.req.nonce,
        });
      }),
      server.errorHandler({ mode: 'indirect' }),
    ],
    token: [
      function (request, _res, next) {
        // Have to keep req.hostname in res to hack around oauth2orize so that issuer can be checked in openidconnect
        debug('oauth2#token: setting client_secret = client_assertion');
        // Todo: hack to use passport-oauth2-client-password
        request.body.client_secret = request.body.client_assertion;

        return next();
      },
      passport.authenticate(['oauth2-client-password'], { session: false }),
      function (request, _res, next) {
        if (!request.user) {
          debug(
            'oauth2#token: there is no req.user after passport.authenticate should have put the client there.'
          );
          next();
        }

        const domain_cfg = domainConfigs[request.hostname] || {
          baseuri: 'https://localhost/',
        };
        request.user.reqdomain = domain_cfg.baseuri;
        next();
      },
      server.token(),
      server.errorHandler({ mode: 'direct' }),
    ],
  };
};
