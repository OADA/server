/**
 * Copyright 2023 Open Ag Data Alliance
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

import { domainConfigs } from './config.js';

import type { FastifyPluginAsync } from 'fastify';

import { fastifyPassport } from './auth.js';

export interface Options {
  endpoints?: {
    login?: string;
    oidcLogin?: string;
    logout?: string;
  };
  views?: {
    loginPage?: string;
  };
}

/**
 * Plugin for handling local login/logout of users
 */
const plugin: FastifyPluginAsync<Options> = async (
  fastify,
  {
    endpoints: {
      login = 'login',
      oidcLogin = 'oidc-login',
      logout = 'logout',
    } = {},
    views: { loginPage = 'login' } = {},
  },
) => {
  // --------------------------------------------------------------------------
  // Login page: someone has navigated or been redirected to the login page.
  // Populate based on the domain.
  // If session already has a userid, then just use that.
  // Deepcode ignore NoRateLimitingForExpensiveWebOperation: This runs behind a reverse-proxy
  fastify.get(login, (request, reply) => {
    request.log.trace(
      `GET ${login}: setting X-Frame-Options=SAMEORIGIN before rendering login`,
    );
    request.log.trace(request.session, 'login endpoint');
    void reply.header('X-Frame-Options', 'SAMEORIGIN');
    // @ts-expect-error TODO: make types for auth bodies/queries
    const isError = Boolean(request.query.error ?? request.session.errormsg);
    const errormsg = request.session.errormsg ?? 'Login failed.';
    if (request.session.errormsg) {
      // Reset for next time
      request.session.errormsg = undefined;
    }

    // Load the login info for this domain from the public directory:
    const domainConfig =
      domainConfigs.get(request.hostname) ?? domainConfigs.get('localhost')!;
    return reply.view(loginPage, {
      // Where should the local login form post:
      login_url: login,
      // Where should the openidconnect form post:
      loginconnect_url: oidcLogin,

      // Domain-specific configs:
      // has .username, .password
      hint: domainConfig.hint ?? { username: '', password: '' },
      logo_url: `domains/${domainConfig.domain}/${domainConfig.logo}`,
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
  // const pfx = config.get('auth.endpointsPrefix');
  fastify.post(
    login,
    {
      preValidation: fastifyPassport.authenticate('local', {
        successReturnToOrRedirect: '',
        failureRedirect: `${login}?error=1`,
      }),
    },
    async ({ user }) => `Logged in as ${user?.name} (${user?.username})`,
  );

  // Logout endpoint
  fastify.get(logout, async (request, reply) => {
    await request.logout();
    return reply.redirect(`${request.headers.Referrer ?? login}`);
  });
};

export default plugin;
