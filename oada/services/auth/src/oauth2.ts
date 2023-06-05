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

import { config, domainConfigs } from './config.js';

import type { ServerResponse } from 'node:http';
import { promisify } from 'node:util';

import type {} from '@fastify/formbody';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { fastifyPassport } from './auth.js';

import oauth2orize, {
  AuthorizationError,
  type IssueExchangeCodeFunction,
  type MiddlewareErrorFunction,
  type MiddlewareFunction,
  type MiddlewareRequest,
  type OAuth2,
  type OAuth2Server,
  type ValidateFunctionArity2,
} from 'oauth2orize';
import { extensions } from 'oauth2orize-pkce';

import { trustedCDP } from '@oada/lookup';

import type { Client, DBClient } from './db/models/client.js';
import { issueCode, issueToken, issueTokenFromCode } from './utils.js';
import type { User } from './db/models/user.js';
import { findById } from './db/models/client.js';

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

declare module 'oauth2orize' {
  interface OAuth2Req {
    nonce?: string;
  }
}
interface DeserializedOauth2<C = Client> extends OAuth2 {
  client: C;
}
interface OAuth2Request<C = Client, U = User> extends MiddlewareRequest {
  oauth2: DeserializedOauth2<C>;
  user: U;
}

export interface Options {
  oauth2server?: OAuth2Server;
  endpoints?: {
    authorize?: string;
    decision?: string;
    token?: string;
  };
}

function isArray(value: unknown): value is unknown[] | readonly unknown[] {
  return Array.isArray(value);
}

type Arguments<M extends MiddlewareFunction | MiddlewareErrorFunction> =
  // eslint-disable-next-line @typescript-eslint/ban-types
  Parameters<M> extends [...rest: infer R, next: unknown] ? R : [];
function promisifyMiddleware<
  M extends MiddlewareFunction | MiddlewareErrorFunction
>(middleware: M | readonly M[]): (...rest: Arguments<M>) => Promise<void> {
  if (isArray(middleware)) {
    const middlewares = middleware.map((m) => promisifyMiddleware(m));
    return async (...rest: Arguments<M>) => {
      for await (const m of middlewares) {
        await m(...rest);
      }
    };
  }

  return promisify(middleware) as (...rest: Arguments<M>) => Promise<void>;
}

/**
 * Fastify plugin for the server side of OAuth2 using oauth2orize
 */
const plugin: FastifyPluginAsync<Options> = async (
  fastify,
  {
    oauth2server = oauth2orize.createServer(),
    endpoints: {
      authorize = 'auth',
      decision = 'decision',
      token = 'token',
    } = {},
  }
) => {
  // PKCE
  oauth2server.grant(extensions());

  // Implicit flow (token)
  oauth2server.grant(oauth2orize.grant.token(issueToken));

  // Code flow (code)
  oauth2server.grant(oauth2orize.grant.code(issueCode));

  // Code flow exchange (code)
  oauth2server.exchange(
    oauth2orize.exchange.code((async (client, code, redirect, done) => {
      try {
        const [token, extras] = await issueTokenFromCode(
          client as DBClient,
          code,
          redirect
        );
        // @ts-expect-error: oauth2orize types are wrong
        done(null, token, extras);
      } catch (error: unknown) {
        done(error as Error);
      }
    }) as IssueExchangeCodeFunction)
  );

  // Decorate fastify reply for compatibility with connect response
  fastify.decorateReply(
    'setHeader',
    function (this: FastifyReply, key: string, value: unknown) {
      return this.header(key, value);
    }
  );
  fastify.decorateReply('end', function (this: FastifyReply, payload: unknown) {
    return this.send(payload);
  });

  const doErrorHandlerIndirect = promisify(
    oauth2server.errorHandler({ mode: 'indirect' })
  );

  // OAuth2 authorization request (serve the authorization screen)
  const doAuthorize = promisifyMiddleware(
    oauth2server.authorize((async ({ clientID, redirectURI }, done) => {
      try {
        const client = await findById(clientID);
        if (!client) {
          done(null, false);
          return;
        }

        // Compare the given redirectUrl to all the clients redirectUrls
        if (client.redirect_uris?.includes(redirectURI)) {
          done(null, client, redirectURI);
          return;
        }

        fastify.log.trace(
          'oauth2#authorize: redirect_uri from URL (%s) does not match any on client cert: %s',
          redirectURI,
          client.redirect_uris
        );
        done(null, false);
        return;
      } catch (error: unknown) {
        done(error as Error);
        // eslint-disable-next-line no-useless-return
        return;
      }
    }) as ValidateFunctionArity2)
  );
  fastify.get(authorize, async (request, reply) => {
    try {
      /* ???
      trace('oauth2#authorize: checking for domain_hint');
      if (request?.query?.domain_hint) {
        request.session.domain_hint = `${request.query.domain_hint}`;
      }
      */
      // TODO: Is this needed? void reply.hijack():
      await doAuthorize(
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse
      );
      const { oauth2, user } = request as unknown as OAuth2Request;

      await trustedCDP();
      // Load the login info for this domain from the public directory:
      const domainConfig =
        domainConfigs.get(request.hostname) ?? domainConfigs.get('localhost')!;
      return await reply.view(config.get('auth.views.approvePage'), {
        transactionID: oauth2.transactionID,
        client: oauth2.client,
        scope: oauth2.req.scope,
        nonce: oauth2.req.nonce,
        trusted: oauth2.client.trusted,
        decision_url: decision,
        user: {
          name: user?.name ?? '',
          username: user?.username ?? 'nobody',
        },
        autoaccept: scopeIsOnlyOpenid(oauth2?.req.scope ?? []),
        logout: config.get('auth.endpoints.logout'),
        name: domainConfig.name,
        logo_url: `domains/${domainConfig.domain}/${domainConfig.logo}`,
        tagline: domainConfig.tagline,
        color: domainConfig.color ?? '#FFFFFF',
      });
    } catch (error: unknown) {
      request.log.error(error, 'OAuth2 authorize error');
      await doErrorHandlerIndirect(
        error as Error,
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse
      );
    }
  });

  const doDecision = promisifyMiddleware(
    oauth2server.decision((request, done) => {
      try {
        // @ts-expect-error body
        const { scope, allow } = request.body as {
          scope?: string[];
          allow?: unknown;
        };
        const validScope = scope?.every((element) =>
          request.oauth2?.req.scope.includes(element)
        );

        if (!validScope) {
          throw new AuthorizationError(
            'Scope does not match original request',
            'invalid_scope'
          );
        }

        fastify.log.trace(
          'decision: allow = %s, scope = %s, nonce = %s',
          allow,
          scope,
          request.oauth2?.req.nonce
        );
        done(null, {
          allow,
          scope,
          nonce: request.oauth2?.req.nonce,
        });
      } catch (error: unknown) {
        done(error as Error, null);
      }
    })
  );
  fastify.post(decision, async (request, reply) => {
    try {
      await doDecision(
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse
      );
    } catch (error: unknown) {
      request.log.error(error, 'OAuth2 decision error');
      await doErrorHandlerIndirect(
        error as Error,
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse
      );
    }
  });

  const doErrorHandlerDirect = promisifyMiddleware(
    oauth2server.errorHandler({ mode: 'direct' })
  );
  const doToken = promisifyMiddleware(oauth2server.token());
  fastify.post(
    token,
    {
      preValidation: fastifyPassport.authenticate(
        ['oauth2-client-password', 'oauth2-client-assertion'],
        {
          session: false,
        }
      ),
    },
    async (request, reply) => {
      try {
        request.log.trace(
          `${request.hostname}: token POST ${config.get(
            'auth.endpoints.token'
          )}, storing reqdomain in req.user`
        );
        const { user } = request as unknown as OAuth2Request;
        if (!user) {
          request.log.trace(
            'oauth2#token: there is no req.user after passport.authenticate should have put the client there.'
          );
          return;
        }

        const domainConfig = domainConfigs.get(request.hostname) ?? {
          baseuri: 'https://localhost/',
        };
        user.reqdomain = domainConfig.baseuri;

        await doToken(
          request as unknown as MiddlewareRequest,
          reply as unknown as ServerResponse
        );
      } catch (error: unknown) {
        request.log.error(error, 'OAuth2 token error');
        await doErrorHandlerDirect(
          error as Error,
          request as unknown as MiddlewareRequest,
          reply as unknown as ServerResponse
        );
      }
    }
  );
};

export default plugin;
