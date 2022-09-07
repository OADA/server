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

import { config, domainConfigs } from './config.js';

import oauth2orize, { AuthorizationError } from 'oauth2orize';
import URI from 'urijs';
import debug from 'debug';
import type express from 'express';
import login from 'connect-ensure-login';
import passport from 'passport';

import { trustedCDP } from '@oada/lookup';

import { issueCode, issueToken, issueTokenFromCode } from './utils.js';
import type { Client } from './db/models/client.js';
import type { User } from './db/models/user.js';
import { findById } from './db/models/client.js';

const trace = debug('oauth2:trace');

// If the array of scopes contains ONLY openid OR openid and profile, auto-accept.
// Better to handle this by asking only the first time, but this is quicker to get PoC working.
function scopeIsOnlyOpenid(scopes: string | readonly string[]): boolean {
  if (typeof scopes === 'string') {
    return scopeIsOnlyOpenid([scopes]);
  }

  if (!scopes) {
    return false;
  }

  if (scopes.length === 1 && scopes[0] === 'openid') {
    return true;
  }

  return (
    scopes.length === 2 &&
    scopes.includes('openid') &&
    scopes.includes('profile')
  );
}

type Handlers = Array<express.RequestHandler | express.ErrorRequestHandler>;

export default class OAuth2 {
  #server;

  constructor(server: oauth2orize.OAuth2Server) {
    this.#server = server;

    // Implicit flow (token)
    server.grant(oauth2orize.grant.token(issueToken));

    // Code flow (code)
    server.grant(oauth2orize.grant.code(issueCode));

    // Code flow exchange (code)
    server.exchange(oauth2orize.exchange.code(issueTokenFromCode));
  }

  /// ///
  // Middleware
  /// ///
  get authorize(): Handlers {
    return [
      // If the redirecting domain sets the "domain_hint", save it in the session so that the login page
      // can fill it in as the default choice:
      async function (
        request: express.Request,
        _response: express.Response,
        next: express.NextFunction
      ) {
        trace('oauth2#authorize: checking for domain_hint');
        if (request?.query?.domain_hint) {
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          request.session.domain_hint = `${request.query.domain_hint}`;
        }

        next();
      },
      // Can access it to pre-fill the domain box
      // ensureLoggedIn fills in req.session.returnTo to let you redirect
      // back after logging in
      login.ensureLoggedIn(config.get('auth.endpoints.login')),
      this.#server.authorization(async (clientId, redirectURI) => {
        const client = await findById(clientId);
        if (!client) {
          return false;
        }

        // Compare the given redirectUrl to all the clients redirectUrls
        for (const redirect of client.redirect_uris ?? []) {
          if (new URI(redirect).equals(redirectURI)) {
            return [client, redirectURI];
          }
        }

        trace(
          'oauth2#authorize: redirect_uri from URL (%s) does not match any on client cert: %s',
          redirectURI,
          client.redirect_uris
        );
        return false;
      }),
      async (request: express.Request, response: express.Response) => {
        await trustedCDP();
        // Load the login info for this domain from the public directory:
        const domainConfig =
          domainConfigs.get(request.hostname) ??
          domainConfigs.get('localhost')!;
        response.render(config.get('auth.views.approvePage'), {
          transactionID: request.oauth2?.transactionID,
          client: request.oauth2?.client as Client,
          scope: request.oauth2?.req.scope,
          // @ts-expect-error nonce
          nonce: request.oauth2?.req.nonce,
          // @ts-expect-error trusted
          trusted: (request.oauth2?.client as Client).trusted,
          decision_url: config.get('auth.endpoints.decision'),
          user: {
            name: (request.user as User)?.name ?? '',
            username: (request.user as User)?.username ?? 'nobody',
          },
          autoaccept: Boolean(
            scopeIsOnlyOpenid(request.oauth2?.req.scope ?? [])
          ),
          logout: config.get('auth.endpoints.logout'),
          name: domainConfig.name,
          logo_url: `${config.get('auth.endpointsPrefix')}/domains/${
            domainConfig.domain
          }/${domainConfig.logo}`,
          tagline: domainConfig.tagline,
          color: domainConfig.color ?? '#FFFFFF',
        });
      },
      this.#server.errorHandler({ mode: 'indirect' }),
    ];
  }

  get decision(): Handlers {
    return [
      async function () {
        trace('oauth2#decision: Received decision POST from form');
      },
      login.ensureLoggedIn(config.get('auth.endpoints.login')),
      this.#server.decision(async (request) => {
        // @ts-expect-error body
        const { scope } = request.body as { scope: string[] };
        const validScope = scope.every((element) =>
          request.oauth2?.req.scope.includes(element)
        );

        if (!validScope) {
          throw new AuthorizationError(
            'Scope does not match original request',
            'invalid_scope'
          );
        }

        trace(
          'decision: allow = %s, scope = %s, nonce = %s',
          // @ts-expect-error allow
          request.allow,
          scope,
          // @ts-expect-error nonce
          request.oauth2?.req.nonce
        );
        return {
          // @ts-expect-error allow
          allow: request.allow,
          scope,
          // @ts-expect-error nonce
          nonce: request.oauth2?.req.nonce,
        };
      }),
      this.#server.errorHandler({ mode: 'indirect' }),
    ];
  }

  get token(): Handlers {
    return [
      async function (request: express.Request) {
        // Have to keep req.hostname in res to hack around oauth2orize so that issuer can be checked in openidconnect
        trace('oauth2#token: setting client_secret = client_assertion');
        // FIXME: Hack to use passport-oauth2-client-password
        request.body.client_secret = request.body.client_assertion;
      },
      passport.authenticate(['oauth2-client-password'], { session: false }),
      async function (request: express.Request) {
        if (!request.user) {
          trace(
            'oauth2#token: there is no req.user after passport.authenticate should have put the client there.'
          );
          return;
        }

        const domainConfig = domainConfigs.get(request.hostname) ?? {
          baseuri: 'https://localhost/',
        };
        (request.user as User).reqdomain = domainConfig.baseuri;
      },
      this.#server.token(),
      this.#server.errorHandler({ mode: 'direct' }),
    ] as Handlers;
  }
}
