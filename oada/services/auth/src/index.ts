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

import '@oada/pino-debug';

import { config, domainConfigs } from './config.js';

import '@oada/lib-prom';
import { arango as database } from '@oada/lib-arangodb';

import https from 'node:https';
import path from 'node:path';
import url from 'node:url';
import util from 'node:util';

import type { RequestHandler } from 'express';
import bodyParser from 'body-parser';
import express from 'express';
import session from 'express-session';

import ArangoSessionStore from 'connect-arango';
import type { Database } from 'arangojs';
import URI from 'urijs';
import cors from 'cors';
import debug from 'debug';
import got from 'got';
import helmet from 'helmet';
import isMain from 'es-main';
import oauth2orize from 'oauth2orize';
import passport from 'passport';
import { pinoHttp } from 'pino-http';

import { middleware as oadaError } from '@oada/error';

// Use the oada-id-client for the openidconnect code flow:
import { middleware as oadaIDClient } from '@oada/id-client';
import wkJson from '@oada/well-known-json';

import './auth.js';
import {
  findByOIDCToken,
  findByOIDCUsername,
  update,
} from './db/models/user.js';
import OAuth2 from './oauth2.js';
import { createUserinfo } from './utils.js';
import dynReg from './dynReg.js';
import { findById } from './db/models/client.js';
import keys from './keys.js';
import oidc from './oidc.js';

declare module 'express-session' {
  interface SessionData {
    errormsg: string;
    returnTo: string;
    domain_hint: string;
  }
}

const info = debug('auth#index:info');
const trace = debug('auth#index:trace');

export default run;

async function run() {
  // Deepcode ignore UseCsurfForExpress: helmet handles this
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          'form-action': null,
        },
      },
    })
  );

  const wkj = config.get('auth.wkj') ?? wkJson.middleware({});

  app.set('view engine', 'ejs');
  app.set('json spaces', config.get('auth.server.jsonSpaces'));
  app.set('views', config.get('auth.views.basedir'));
  app.set('trust proxy', config.get('auth.server.proxy'));

  app.use(pinoHttp());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(
    session({
      secret: config.get('auth.server.sessionSecret'),
      resave: false,
      saveUninitialized: false,
      store: new ArangoSessionStore({
        collection: config.get('arangodb.collections.sessions').name,
        db: database as Database,
      }),
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  const server = oauth2orize.createServer();
  server.serializeClient((client, done) => {
    done(null, client.clientId);
  });
  server.deserializeClient(async (id, done) => {
    try {
      const out = await findById(id);
      done(null, out);
    } catch (error: unknown) {
      done(error as Error);
    }
  });

  /// ///
  // UI
  /// ///
  if (config.get('auth.oauth2.enable') || config.get('auth.oidc.enable')) {
    const oauth2 = new OAuth2(server);

    // ----------------------------------------------------------------
    // Client registration endpoint:
    app.options(
      config.get('auth.endpoints.register'),
      cors() as RequestHandler
    );
    app.post(
      config.get('auth.endpoints.register'),
      cors() as RequestHandler,
      bodyParser.json(),
      dynReg
    );

    // ----------------------------------------------------------------
    // OAuth2 authorization request (serve the authorization screen)
    app.get(
      config.get('auth.endpoints.authorize'),
      (async (_, response, next) => {
        trace(
          `GET ${config.get(
            'auth.endpoints.authorize'
          )}: setting X-Frame-Options=SAMEORIGIN before oauth2.authorize`
        );
        response.header('X-Frame-Options', 'SAMEORIGIN');
        next();
      }) as RequestHandler,
      oauth2.authorize
    );
    app.post(config.get('auth.endpoints.decision'), oauth2.decision);
    app.post(
      config.get('auth.endpoints.token'),
      (async (request, _response, next) => {
        trace(
          `${request.hostname}: token POST ${config.get(
            'auth.endpoints.token'
          )}, storing reqdomain in req.user`
        );
        next();
      }) as RequestHandler,
      oauth2.token
    );

    // --------------------------------------------------------------------------
    // Login page: someone has navigated or been redirected to the login page.
    // Populate based on the domain.
    // If session already has a userid, then just use that.
    // Deepcode ignore NoRateLimitingForExpensiveWebOperation: This runs behind a reverse-proxy
    app.get(config.get('auth.endpoints.login'), (request, response) => {
      trace(
        `GET ${config.get(
          'auth.endpoints.login'
        )}: setting X-Frame-Options=SAMEORIGIN before rendering login`
      );
      trace(request.session, 'login endpoint');
      response.header('X-Frame-Options', 'SAMEORIGIN');
      const isError = Boolean(request.query.error ?? request.session.errormsg);
      const errormsg = request.session.errormsg ?? 'Login failed.';
      if (request.session.errormsg) {
        // Reset for next time
        request.session.errormsg = undefined;
      }

      // Load the login info for this domain from the public directory:
      const domainConfig =
        domainConfigs.get(request.hostname) ?? domainConfigs.get('localhost')!;
      response.render(config.get('auth.views.loginPage'), {
        // Where should the local login form post:
        login_url: config.get('auth.endpoints.login'),
        // Where should the openidconnect form post:
        loginconnect_url: config.get('auth.endpoints.loginConnect'),

        // Domain-specific configs:
        // has .username, .password
        hint: domainConfig.hint || { username: '', password: '' },
        logo_url: `${config.get('auth.endpointsPrefix')}/domains/${
          domainConfig.domain
        }/${domainConfig.logo}`,
        name: domainConfig.name,
        tagline: domainConfig.tagline,
        color: domainConfig.color ?? '#FFFFFF',
        idService: domainConfig.idService, // Has .shortname, .longname
        iserror: isError,
        errormsg,

        // Domain_hint can be set when authorization server redirects to login
        domain_hint: 'growersync.trellisfw.io', // Req.session.domain_hint || '',
      });
    });

    // ---------------------------------------------------
    // Handle post of local form from login page:
    const pfx = config.get('auth.endpointsPrefix');
    app.post(
      config.get('auth.endpoints.login'),
      passport.authenticate('local', {
        successReturnToOrRedirect: path.join('/', pfx),
        failureRedirect: `${config.get('auth.endpoints.login')}?error=1`,
      })
    );

    // -----------------------------------------------------------------
    // Handle the POST from clicking the "login with OADA/trellisfw" button
    app.post(
      config.get('auth.endpoints.loginConnect'),
      async (request, response) => {
        // First, get domain entered in the posted form
        // and strip protocol if they used it
        const destinationDomain = `${request.body?.dest_domain}`.replace(
          /^https?:\/\//,
          ''
        );

        request.body.dest_domain = destinationDomain;
        info(
          `${config.get(
            'auth.endpoints.loginConnect'
          )}: OpenIDConnect request to redirect from domain ${
            request.hostname
          } to domain ${destinationDomain}`
        );

        // Next, get the info for the id client middleware based on main domain:
        const domainConfig =
          domainConfigs.get(request.hostname) ??
          domainConfigs.get('localhost')!;
        const options = {
          metadata: domainConfig.software_statement,
          redirect: `https://${
            request.hostname
            // The config already has the pfx added
          }${config.get('auth.endpoints.redirectConnect')}`,
          scope: 'openid profile',
          prompt: 'consent',
          privateKey: domainConfig.keys.private,
        };

        // And call the middleware directly so we can use closure variables:
        trace(
          '%s: calling getIDToken for dest_domain = %s',
          config.get('auth.endpoints.loginConnect'),
          destinationDomain
        );
        await oadaIDClient.getIDToken({ domain: destinationDomain, options })(
          request,
          response
        );
      }
    );

    // -----------------------------------------------------
    // Handle the redirect for openid connect login:
    app.use(
      config.get('auth.endpoints.redirectConnect'),
      async (request) => {
        info(
          '+++++++++++++++++++=====================++++++++++++++++++++++++',
          `${config.get(
            'auth.endpoints.redirectConnect'
          )}, req.user.reqdomain = ${
            request.hostname
          }: OpenIDConnect request returned`
        );
        // Get the token for the user
      },
      oadaIDClient.handleRedirect,
      async (request, response) => {
        // "Token" is both an id token and an access token
        // @ts-expect-error token
        const { id_token: idToken, access_token: token } = request.token!;

        // Should have req.token after this point
        // Actually log the user in here, maybe get user info as well
        // Get the user info:
        //  proper method is to ask again for profile permission
        //  after getting the idToken
        //  and determining we don't know this ID token.
        //  If we do know it, don't worry about it
        info(
          '*+*+*+*+*+*+*+*+*+*+*+*+*+*+*+*+*+**+*+*+*+*+*+*+*======',
          `${config.get('auth.endpoints.redirectConnect')}, req.hostname = ${
            request.hostname
          }: token is: %O`,
          idToken
        );
        let user = await findByOIDCToken(idToken);
        if (!user) {
          const uri = new URI(idToken.iss);
          uri.path('/.well-known/openid-configuration');
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          const cfg = await got(uri.toString()).json<{
            userinfo_endpoint: string;
          }>();

          const userinfo = await got(cfg.userinfo_endpoint, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }).json<{
            preferred_username: string;
          }>();

          user = await findByOIDCUsername(
            userinfo.preferred_username,
            idToken.iss
          );

          if (!user) {
            // We don't have a user with this sub or username,
            // so they don't have an account
            request.session.errormsg = `There is no user ${userinfo.preferred_username} from ${idToken.iss}`;
            info(
              'Failed OIDC login: user not found.  Redirecting to %s',
              request.session.returnTo
            );
            // Deepcode ignore OR: session is not actually from request
            response.redirect(request.session.returnTo!);
            return;
          }

          // Add sub to existing user
          // TODO: Make a link function or something
          //       instead of shoving sub where it goes?
          user.oidc!.sub = idToken.sub;
          await update(user);
        }

        // Put user into session
        const login = util.promisify(request.login.bind(request));
        await login(user);

        // Send user back where they started
        response.redirect(request.session.returnTo!);
        // Look them up by oidc.sub and oidc.iss,
        // get their profile data to get username if not found?
        // save user in the session somehow
        // to indicate to passport that we are logged in.
        // redirect to req.session.returnTo from passport
        // and/or connect-ensure-login
        // since this will redirect them
        // back to where they originally wanted to go
        // which was likely an oauth request.
      }
    );

    app.get(config.get('auth.endpoints.logout'), async (request, response) => {
      const logout = util.promisify(request.logout);
      await logout();
      response.redirect(request.get('Referrer')!);
    });

    if (config.get('auth.endpointsPrefix')) {
      app.use(
        config.get('auth.endpointsPrefix'),
        express.static(
          path.join(
            path.dirname(url.fileURLToPath(import.meta.url)),
            '..',
            'public'
          )
        )
      );
    } else {
      app.use(
        express.static(
          path.join(
            path.dirname(url.fileURLToPath(import.meta.url)),
            '..',
            'public'
          )
        )
      );
    }

    // Statically serve all the domains-enabled/*/auth-www folders:
    for (const domain of domainConfigs.keys()) {
      const onDisk = `${config.get('domainsDir')}/${domain}/auth-www`;
      const webpath = `${config.get('auth.endpointsPrefix')}/domains/${domain}`;
      trace(
        `Serving domain ${domain}/auth-www statically, on disk = ${onDisk}, webpath = ${webpath}`
      );
      app.use(webpath, express.static(onDisk));
    }
  }

  /// ///
  // OAuth 2.0
  /// ///
  if (config.get('auth.oauth2.enable')) {
    wkj.addResource('oada-configuration', {
      authorization_endpoint: `./${config.get('auth.endpoints.authorize')}`,
      token_endpoint: `./${config.get('auth.endpoints.token')}`,
      registration_endpoint: `./${config.get('auth.endpoints.register')}`,
      token_endpoint_auth_signing_alg_values_supported: ['RS256'],
    });
  }

  /// ///
  // OIDC
  /// ///
  if (config.get('auth.oidc.enable')) {
    oidc(server);

    app.options(config.get('auth.endpoints.certs'), cors() as RequestHandler);
    app.get(
      config.get('auth.endpoints.certs'),
      cors() as RequestHandler,
      (_request, response) => {
        response.json(keys.jwks);
      }
    );

    app.options(
      config.get('auth.endpoints.userinfo'),
      cors() as RequestHandler
    );
    app.get(
      config.get('auth.endpoints.userinfo'),
      cors() as RequestHandler,
      passport.authenticate('bearer', { session: false }),
      (request, response) => {
        const userinfo = createUserinfo(
          request.user as unknown as Record<string, unknown>,
          // @ts-expect-error scope
          request.authInfo?.scope
        );

        if (userinfo?.sub === undefined) {
          response.status(401).end('Unauthorized');
        } else {
          response.json(userinfo);
        }
      }
    );

    wkj.addResource('openid-configuration', {
      issuer: './', // Config.get('auth.server.publicUri'),
      registration_endpoint: `./${config.get('auth.endpoints.register')}`,
      authorization_endpoint: `./${config.get('auth.endpoints.authorize')}`,
      token_endpoint: `./${config.get('auth.endpoints.token')}`,
      userinfo_endpoint: `./${config.get('auth.endpoints.userinfo')}`,
      jwks_uri: `./${config.get('auth.endpoints.certs')}`,
      response_types_supported: [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'id_token token',
        'code id_token token',
      ],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
    });
  }

  /// //
  // .well-known
  /// //
  if (!config.get('auth.wkj')) {
    app.use(wkj);
  }

  /// //
  // Standard OADA Error
  /// //
  app.use(oadaError());

  return app;
}

if (isMain(import.meta)) {
  const app = await run();
  // Note: now we listen on both http and https by default.  https is only
  // for debugging trying to use localhost or 127.0.0.1, since that will resolve
  // inside the container itself instead of as the overall host.
  if (config.get('auth.server.mode') === 'http') {
    const server = app.listen(config.get('auth.server.port-http'), () => {
      const address = server.address();
      const uri =
        typeof address === 'string'
          ? address
          : `${address!.address}:${address?.port}`;
      info('Listening HTTP on %s', uri);
    });
  } else {
    // @ts-expect-error nonsense
    const server = https.createServer(config.get('auth.certs'), app);
    server.listen(config.get('auth.server.port-https'), () => {
      const address = server.address();
      const uri =
        typeof address === 'string'
          ? address
          : `${address!.address}:${address?.port}`;
      info('Listening HTTPS on %s', uri);
    });
  }
}
