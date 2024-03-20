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

import { join } from 'node:path/posix';

import { config } from './config.js';

import type { FastifyPluginAsync } from 'fastify';
import fastifyAccepts from '@fastify/accepts';

import {
  Issuer,
  Strategy as OIDCStrategy,
  type StrategyVerifyCallbackUserInfo,
} from 'openid-client';
import { type OAuth2Server, createServer } from 'oauth2orize';
import { SignJWT, exportJWK } from 'jose';
import oauth2orizeOpenId, { type IssueIDToken } from 'oauth2orize-openid';

import memoize from 'p-memoize';

import { plugin as wkj } from '@oada/well-known-json/plugin';

import {
  type User,
  findByOIDCToken,
  findByOIDCUsername,
  register,
  update,
} from './db/models/user.js';
import {
  getKeyPair,
  issueCode,
  issueToken,
  jwksPublic as oauthJWKs,
} from './oauth2.js';
import type { Client } from './db/models/client.js';
import type { JsonSchemaToTsProvider } from '@fastify/type-provider-json-schema-to-ts';
import { createUserinfo } from './utils.js';
import { fastifyPassport } from './auth.js';

export interface Options {
  oauth2server?: OAuth2Server;
  endpoints?: {
    oidcLogin?: string;
    oidcRedirect?: string;
  };
}

declare module 'oauth2orize' {
  interface OAuth2Req {
    userinfo?: boolean;
  }
}

declare module 'openid-client' {
  interface TypeOfGenericClient {
    register(
      metadata: Omit<ClientMetadata, 'client_id'>,
      other?: RegisterOther & ClientOptions,
    ): Promise<BaseClient>;
  }
}

const idToken = config.get('auth.idToken');

const kid = 'openid-1';

// TODO: Support key rotation and stuff
const { publicKey, privateKey } = await getKeyPair(
  await idToken.key,
  idToken.alg,
);
const jwksPublic = {
  keys: [
    {
      kid,
      alg: idToken.alg,
      use: 'sig',
      ...(await exportJWK(publicKey)),
    },
    ...oauthJWKs.keys,
  ],
};
const jwksPrivate = {
  keys: [{ kid, ...(await exportJWK(privateKey)) }],
};

export const issueIdToken: IssueIDToken<Client, User> = async (
  client,
  user,
  req,
  done,
) => {
  const userinfoScope: string[] = req.userinfo ? req.scope : [];
  const userinfo = createUserinfo(
    user as unknown as Record<string, unknown>,
    userinfoScope,
  );

  const payload: Record<string, unknown> = {
    ...userinfo,
    nonce: req.nonce,
  };

  const token = await new SignJWT(payload)
    .setProtectedHeader({ kid, alg: idToken.alg })
    .setIssuedAt()
    .setExpirationTime(idToken.expiresIn)
    .setAudience(client.client_id)
    .setIssuer(req.issuer)
    .setSubject(user._id)
    .sign(privateKey);
  // eslint-disable-next-line unicorn/no-null
  done(null, token);
};

/**
 * Fastify plugin for the server side of OAuth2 using oauth2orize
 */
const plugin: FastifyPluginAsync<Options> = async (
  f,
  {
    oauth2server = createServer(),
    endpoints: { oidcLogin = 'oidc-login' } = {},
  },
) => {
  const fastify = f.withTypeProvider<JsonSchemaToTsProvider>();

  oauth2server.grant(oauth2orizeOpenId.extensions());

  if (config.get('auth.oauth2.allowImplicitFlows')) {
    // Implicit flow (id_token)
    oauth2server.grant(
      oauth2orizeOpenId.grant.idToken(
        (client: Client, user: User, ares, done) => {
          ares.userinfo = true;
          issueIdToken(client, user, ares, done);
        },
      ),
    );

    // Implicit flow (id_token token)
    oauth2server.grant(
      oauth2orizeOpenId.grant.idTokenToken(issueToken, issueIdToken),
    );
  }

  // Hybrid flow (code id_token)
  oauth2server.grant(
    oauth2orizeOpenId.grant.codeIdToken(issueCode, issueIdToken),
  );

  // Hybrid flow (code token)
  oauth2server.grant(oauth2orizeOpenId.grant.codeToken(issueToken, issueCode));

  // Hybrid flow (code id_token token)
  oauth2server.grant(
    oauth2orizeOpenId.grant.codeIdTokenToken(
      issueToken,
      issueCode,
      issueIdToken,
    ),
  );

  await fastify.register(fastifyAccepts);

  const getOIDCAuth = memoize(
    async (from: string, to: string) => {
      const issuer = await Issuer.discover(to);

      // Next, get the info for the id client middleware based on main domain:
      /*
        const domainConfig =
          domainConfigs.get(from) ??
          domainConfigs.get('localhost')!;
        */

      const redirect = `https://${join(from, fastify.prefix, oidcLogin, to)}`;
      const { metadata } = await issuer.Client.register(
        {
          client_name: 'OADA Auth Server',
          // Software_statement: domainConfig.software_statement,
          redirect_uris: [redirect],
          id_token_signed_response_alg: 'HS256',
        },
        { jwks: jwksPrivate },
      );
      const client = new issuer.Client({
        ...metadata,
        // FIXME: Why does Auth0 need this?
        id_token_signed_response_alg: 'HS256',
      });
      fastify.log.debug({ client, from, to }, 'Registered client with OIDC');

      const name = `oidc-${from}-${to}` as const;
      fastifyPassport.use(
        name,
        new OIDCStrategy<unknown>(
          {
            client,
            params: {
              prompt: 'consent',
              scope: 'openid profile email',
            },
          },
          (async (tokenSet, user, done) => {
            try {
              fastify.log.debug(
                { client, tokenSet, user },
                'OIDC user verify callback',
              );
              const claims = tokenSet.claims();
              let u =
                (await findByOIDCToken(claims)) ??
                (user.preferred_username &&
                  (await findByOIDCUsername(
                    user.preferred_username,
                    claims.iss,
                  )));

              if (!u) {
                if (
                  !config.get('auth.oidc.enable') &&
                  config.get('oidc.issuer') !== claims.iss
                ) {
                  // We don't have a user with this sub or username,
                  // so they don't have an account
                  throw new Error(
                    `There is no known user ${claims.sub} from ${claims.iss}`,
                  );
                }

                // Add sub to existing user
                // TODO: Make a link function or something
                //       instead of shoving sub where it goes?
                u = await register({ oidc: { [to]: claims } });
              }

              await update(u);

              // eslint-disable-next-line unicorn/no-null
              done(null, u);
            } catch (error: unknown) {
              done(error as Error);
            }
          }) satisfies StrategyVerifyCallbackUserInfo<unknown>,
        ),
      );

      return name;
    },
    {
      cacheKey(all) {
        return all.join(',');
      },
    },
  );

  // -----------------------------------------------------------------
  // Handle the POST from clicking the "login with OADA/trellisfw" button
  fastify.post(
    oidcLogin,
    {
      schema: {
        body: {
          type: 'object',
          properties: {
            dest_domain: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['dest_domain'],
        },
      },
    },
    (request, reply) =>
      reply.redirect(join(oidcLogin, request.body.dest_domain)),
  );
  fastify.get(
    join(oidcLogin, '/:dest_domain'),
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            dest_domain: {
              type: 'string',
              format: 'uri',
            },
          },
          required: ['dest_domain'],
        },
      },
      async preValidation(request, reply) {
        // First, get domain entered in the posted form
        // and strip protocol if they used it
        const destinationDomain = request.params?.dest_domain;

        request.log.info(
          `${oidcLogin}: OpenIDConnect request to redirect from domain ${request.hostname} to domain ${destinationDomain}`,
        );

        const name = await getOIDCAuth(request.hostname, destinationDomain);
        return fastifyPassport
          .authenticate(
            name,
            {
              failWithError: true,
            },
            // eslint-disable-next-line max-params
            async (req, res, error, user, info, status) => {
              const cause = error ?? (info instanceof Error ? info : undefined);
              request.log[cause ? 'error' : 'trace'](
                { req, res, err: cause, error, user, info, status },
                'OIDC authenticate callback',
              );
              if (cause) {
                throw new Error('OIDC authentication failure', { cause });
              }
            },
          )
          .call(this, request, reply);
      },
    },
    (request) =>
      process.env.NODE_ENV === 'production' ? 'Logged in' : request.user,
  );

  fastify.get(config.get('auth.endpoints.certs'), async () => jwksPublic);

  fastify.get(
    config.get('auth.endpoints.userinfo'),
    {
      preValidation: fastifyPassport.authenticate('bearer', { session: false }),
    },
    (request, reply) => {
      const userinfo = createUserinfo(
        request.user as unknown as Record<string, unknown>,
        request.authInfo?.scope,
      );

      if (userinfo?.sub === undefined) {
        void reply.unauthorized();
      } else {
        return userinfo;
      }
    },
  );

  // TODO: Should this just be in the well-known service?
  const configuration = {
    issuer: './', // Config.get('auth.server.publicUri'),
    registration_endpoint: `.${join('/', fastify.prefix, config.get('auth.endpoints.register'))}`,
    authorization_endpoint: `.${join('/', fastify.prefix, config.get('auth.endpoints.authorize'))}`,
    token_endpoint: `.${join('/', fastify.prefix, config.get('auth.endpoints.token'))}`,
    userinfo_endpoint: `.${join('/', fastify.prefix, config.get('auth.endpoints.userinfo'))}`,
    jwks_uri: `.${join('/', fastify.prefix, config.get('auth.endpoints.certs'))}`,
    response_types_supported: [
      ...(config.get('auth.oauth2.allowImplicitFlows')
        ? (['token', 'id_token', 'id_token token'] as const)
        : []),
      'code',
      'code token',
      'code id_token',
      'code id_token token',
    ],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: [config.get('auth.idToken.alg')],
    token_endpoint_auth_methods_supported: ['client_secret_post'],
  } as const;

  fastify.log.debug({ configuration }, 'Loaded OIDC configuration');

  // Redirect other OIDC config endpoints to openid-configuration endpoint
  await fastify.register(
    async (app) => {
      app.all('/oada-configuration', async (_request, reply) =>
        reply.redirect(301, 'openid-configuration'),
      );
      app.all('/oauth-authorization-server', async (_request, reply) =>
        reply.redirect(301, 'openid-configuration'),
      );
    },
    { prefix: '/.well-known/' },
  );

  await fastify.register(wkj, {
    resources: {
      'openid-configuration': configuration,
    },
  });
};

export default plugin;
