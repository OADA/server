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

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  createSecretKey,
  randomBytes,
} from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { promisify } from 'node:util';

import type {} from '@fastify/formbody';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { fastifyPassport } from './auth.js';

import {
  EncryptJWT,
  type JWTDecryptResult,
  type JWTPayload,
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  generateSecret,
  jwtDecrypt,
  jwtVerify,
} from 'jose';
import oauth2orize, {
  AuthorizationError,
  type IssueGrantCodeFunctionArity6,
  type IssueGrantTokenFunctionArity4,
  type MiddlewareRequest,
  type OAuth2,
  type OAuth2Req,
  type OAuth2Server,
  TokenError,
  type ValidateFunctionArity2,
} from 'oauth2orize';
import { extensions } from 'oauth2orize-pkce';

import { trustedCDP } from '@oada/lookup';

import { Authorization } from '@oada/models/authorization';
import type { Client } from './db/models/client.js';
import type { User } from './db/models/user.js';
import { findById } from './db/models/client.js';
import { promisifyMiddleware } from './utils.js';

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
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface OAuth2Req {
    nonce?: string;
    issuer: string;
  }

  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface MiddlewareRequest extends FastifyRequest {}
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

export const kid = 'oauth2-1';
// eslint-disable-next-line @typescript-eslint/ban-types
export async function getKeyPair(file: File | string | null, alg: string) {
  if (!file) {
    return generateKeyPair(alg);
  }

  // Assume file is a private key
  const privateKey = createPrivateKey(
    typeof file === 'string' ? file : Buffer.from(await file.arrayBuffer()),
  );
  // Derive a public key from the private key
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey };
}

const tokenConfig = config.get('auth.token');

// TODO: Support key rotation and stuff
const { publicKey, privateKey } = await getKeyPair(
  await tokenConfig.key,
  tokenConfig.alg,
);
export const jwksPublic = {
  keys: [
    {
      kid,
      alg: tokenConfig.alg,
      use: 'sig',
      ...(await exportJWK(publicKey)),
    },
  ],
};
const JWKS = createLocalJWKSet(jwksPublic);

/**
 * Set of claims we include in our signed JWT bearer tokens
 */
export interface TokenClaims extends Authorization, JWTPayload {}

export async function getToken(
  issuer: string,
  claims: TokenClaims,
  {
    iat,
    nbf,
    exp = config.get('auth.token.expiresIn'),
  }: {
    iat?: string | number | Date;
    nbf?: string | number | Date;
    exp?: string | number | Date;
  } = {},
) {
  try {
    const jwt = new SignJWT(claims)
      .setProtectedHeader({
        alg: tokenConfig.alg,
        kid,
        jku: config.get('auth.endpoints.certs'),
      })
      .setJti(randomBytes(16).toString('hex'))
      .setIssuedAt(iat)
      .setIssuer(issuer)
      // ???: Should the audience be something different?
      // .setAudience(issuer)
      .setNotBefore(nbf ?? new Date());

    if (claims.user) {
      jwt.setSubject(claims.user._id);
    }

    if (exp) {
      jwt.setExpirationTime(exp);
    }

    return await jwt.sign(privateKey);
  } catch (error: unknown) {
    throw new Error('Failed to issue token', { cause: error });
  }
}

export async function verifyToken(issuer: string, token: string) {
  const { payload } = await jwtVerify<TokenClaims>(token, JWKS, {
    issuer,
    audience: issuer,
  });
  return payload;
}

export const issueToken = (async (
  _client: Client,
  user: User,
  request: OAuth2Req,
  done,
) => {
  try {
    const auth = new Authorization({
      user,
      scope: request.scope.join(' '),
    });
    // TODO: Fill out user info
    const token = await getToken(request.issuer, { ...auth });
    // eslint-disable-next-line unicorn/no-null
    done(null, token, { expires_in: tokenConfig.expiresIn });
  } catch (error: unknown) {
    done(error as Error);
  }
}) satisfies IssueGrantTokenFunctionArity4;

interface CodePayload {
  issuer: string;
  user: User['_id'];
  scope: string;
}

const authCode = config.get('auth.code');
const key = (await authCode.key)
  ? createSecretKey(
      (await (await authCode.key)!.arrayBuffer()) as NodeJS.ArrayBufferView,
    )
  : await generateSecret(authCode.alg);
export const issueCode: IssueGrantCodeFunctionArity6 = async (
  client: Client,
  redirectUri,
  user: User,
  _,
  request: OAuth2Req,
  done,
  // eslint-disable-next-line max-params
) => {
  try {
    if (!request.codeChallenge && authCode.pkce.required) {
      /**
       * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.4.1}
       */
      throw new TokenError('Code challenge required', 'invalid_request');
    }

    if (
      !authCode.pkce.allowPlainTransform &&
      request.codeChallengeMethod === 'plain'
    ) {
      /**
       * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.4.1}
       */
      throw new TokenError(
        'Plain transform algorithm not supported',
        'invalid_request',
      );
    }

    const payload = {
      user: user._id,
      issuer: request.issuer,
      scope: request.scope.join(' '),
    } as const satisfies CodePayload;
    const code = await new EncryptJWT(payload)
      .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
      .setSubject(redirectUri)
      .setAudience(client.client_id)
      .setIssuedAt()
      .setExpirationTime(authCode.expiresIn)
      .encrypt(key);
    // eslint-disable-next-line unicorn/no-null
    done(null, code);
  } catch (error: unknown) {
    done(error as Error);
  }
};

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
      token: tokenEndpoint = 'token',
    } = {},
  },
) => {
  // PKCE
  oauth2server.grant(extensions());

  oauth2server.grant('*', (request) => ({
    issuer: `${request.protocol}://${request.hostname}/` as const,
  }));

  if (config.get('auth.oauth2.allowImplicitFlows')) {
    // Implicit flow (token)
    oauth2server.grant(oauth2orize.grant.token(issueToken));
  }

  // Code flow (code)
  oauth2server.grant(oauth2orize.grant.code(issueCode));

  // Code flow exchange
  oauth2server.exchange(
    oauth2orize.exchange.code(
      async (
        client: Client,
        code,
        redirectUri,
        { code_verifier },
        _authInfo,
        done,
        // eslint-disable-next-line max-params
      ) => {
        try {
          const { payload } = (await jwtDecrypt(code, key, {
            audience: client.client_id,
            subject: redirectUri,
          })) as JWTDecryptResult & { payload?: CodePayload };
          if (!payload) {
            throw new TokenError('Invalid code', 'invalid_code');
          }

          // Do PKCE check for the code
          if (payload.codeChallenge) {
            switch (payload.codeChallengeMethod) {
              case 'plain': {
                if (code_verifier !== payload.codeChallenge) {
                  throw new TokenError(
                    'Invalid code_verifier',
                    'invalid_grant',
                  );
                }

                break;
              }

              /**
               * @see {@link https://datatracker.ietf.org/doc/html/rfc7636#section-4.6}
               */
              case 'S256': {
                const sha256 = createHash('sha256');
                const hash = sha256
                  .update(code_verifier as string)
                  .digest('base64url');
                if (hash !== payload.codeChallenge) {
                  throw new TokenError(
                    'Invalid code_verifier',
                    'invalid_grant',
                  );
                }

                break;
              }

              default: {
                throw new TokenError(
                  `Unknown code_challenge_method ${payload.codeChallengeMethod}`,
                  'invalid_grant',
                );
              }
            }
          }

          const { issuer, user, scope } = payload;
          const auth = new Authorization({
            user: { _id: user },
            scope,
          });
          const token = await getToken(issuer, {
            ...auth,
          });
          const extras: Record<string, unknown> = {
            expires_in: tokenConfig.expiresIn,
          };

          /**
           * @todo Implement refresh tokens
           */
          const refresh = undefined;

          // eslint-disable-next-line unicorn/no-null
          done(null, token, refresh, extras);
        } catch (error: unknown) {
          done(error as Error);
        }
      },
    ),
  );

  // Decorate fastify reply for compatibility with connect response
  fastify.decorateReply(
    'setHeader',
    function (this: FastifyReply, name: string, value: unknown) {
      return this.header(name, value);
    },
  );
  fastify.decorateReply('end', function (this: FastifyReply, payload: unknown) {
    return this.send(payload);
  });

  const doErrorHandlerIndirect = promisify(
    oauth2server.errorHandler({ mode: 'indirect' }),
  );

  // OAuth2 authorization request (serve the authorization screen)
  const doAuthorize = promisifyMiddleware(
    oauth2server.authorize((async ({ clientID, redirectURI }, done) => {
      try {
        const client = await findById(clientID);
        if (!client) {
          // eslint-disable-next-line unicorn/no-null
          done(null, false);
          return;
        }

        // Compare the given redirectUrl to all the clients redirectUrls
        if (client.redirect_uris?.includes(redirectURI)) {
          // eslint-disable-next-line unicorn/no-null
          done(null, client, redirectURI);
          return;
        }

        fastify.log.trace(
          'oauth2#authorize: redirect_uri from URL (%s) does not match any on client cert: %s',
          redirectURI,
          client.redirect_uris,
        );
        // eslint-disable-next-line unicorn/no-null
        done(null, false);
      } catch (error: unknown) {
        done(error as Error);
        // eslint-disable-next-line no-useless-return
        return;
      }
    }) as ValidateFunctionArity2),
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
        reply as unknown as ServerResponse,
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
        reply as unknown as ServerResponse,
      );
    }
  });

  const doDecision = promisifyMiddleware(
    oauth2server.decision((request, done) => {
      try {
        const { scope, allow } = request.body as {
          scope?: string[];
          allow?: unknown;
        };
        const validScope = scope?.every((element) =>
          request.oauth2?.req.scope.includes(element),
        );

        if (!validScope) {
          throw new AuthorizationError(
            'Scope does not match original request',
            'invalid_scope',
          );
        }

        fastify.log.trace(
          'decision: allow = %s, scope = %s, nonce = %s',
          allow,
          scope,
          request.oauth2?.req.nonce,
        );
        // eslint-disable-next-line unicorn/no-null
        done(null, {
          allow,
          scope,
          nonce: request.oauth2?.req.nonce,
        });
      } catch (error: unknown) {
        // eslint-disable-next-line unicorn/no-null
        done(error as Error, null);
      }
    }),
  );
  fastify.post(decision, async (request, reply) => {
    try {
      await doDecision(
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse,
      );
    } catch (error: unknown) {
      request.log.error(error, 'OAuth2 decision error');
      await doErrorHandlerIndirect(
        error as Error,
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse,
      );
    }
  });

  const doErrorHandlerDirect = promisifyMiddleware(
    oauth2server.errorHandler({ mode: 'direct' }),
  );
  const doToken = promisifyMiddleware(oauth2server.token());
  fastify.post(
    tokenEndpoint,
    {
      preValidation: fastifyPassport.authenticate(
        ['oauth2-client-password', 'oauth2-client-assertion'],
        {
          session: false,
        },
      ),
    },
    async (request, reply) => {
      try {
        request.log.trace(
          `${request.hostname}: token POST ${config.get(
            'auth.endpoints.token',
          )}, storing reqdomain in req.user`,
        );
        const { user } = request as unknown as OAuth2Request;
        if (!user) {
          request.log.trace(
            'oauth2#token: there is no req.user after passport.authenticate should have put the client there.',
          );
          return;
        }

        const domainConfig = domainConfigs.get(request.hostname) ?? {
          baseuri: 'https://localhost/',
        };
        user.reqdomain = domainConfig.baseuri;

        await doToken(
          request as unknown as MiddlewareRequest,
          reply as unknown as ServerResponse,
        );
      } catch (error: unknown) {
        request.log.error(error, 'OAuth2 token error');
        await doErrorHandlerDirect(
          error as Error,
          request as unknown as MiddlewareRequest,
          reply as unknown as ServerResponse,
        );
      }
    },
  );
};

export default plugin;
