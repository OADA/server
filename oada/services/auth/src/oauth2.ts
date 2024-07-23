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
import { createHash } from 'node:crypto';
import { join } from 'node:path/posix';
import { promisify } from 'node:util';

import type {} from '@fastify/formbody';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';

import {
  EncryptJWT,
  type JWTDecryptResult,
  type JWTPayload,
  jwtDecrypt,
} from 'jose';
import oauth2orize, {
  AuthorizationError,
  type IssueExchangeCodeFunctionArity5,
  type IssueGrantCodeFunctionArity6,
  type IssueGrantTokenFunctionArity4,
  type MiddlewareRequest,
  type OAuth2,
  type OAuth2Req,
  type OAuth2Server,
  TokenError,
  type ValidateFunctionArity2,
} from 'oauth2orize';
import oauth2orizeDeviceCode, {
  type ActivateDeviceCodeFunction,
  type ExchangeDeviceCodeFunction,
  type IssueDeviceCodeFunction,
} from 'oauth2orize-device-code';
import { extensions } from 'oauth2orize-pkce';

import { trustedCDP } from '@oada/lookup';

import { type Client, findById } from './db/models/client.js';
import {
  type Token,
  create as createToken,
  verify,
} from './db/models/token.js';
import {
  activate as _activateDeviceCode,
  create as createDeviceCode,
  findByDeviceCode,
  // FindByUserCode,
  redeem,
} from './db/models/deviceCode.js';
import { Authorization } from '@oada/models/authorization';
import type { User } from './db/models/user.js';
import { fastifyPassport } from './auth.js';
import { getSymmetricKey } from './keys.js';
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
    authInfo: {
      issuer: string;
    };
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
    deviceAuthorization?: string;
    activate?: string;
  };
}

const tokenConfig = config.get('auth.token');

/**
 * Set of claims we include in our signed JWT bearer tokens
 */
export type TokenClaims = Record<string, unknown> & Authorization & JWTPayload;

export async function getToken(
  issuer: string,
  {
    exp = config.get('auth.token.expiresIn') / 1000,
    ...claims
  }: Partial<Token>,
) {
  try {
    return await createToken({ ...claims, exp }, issuer);
  } catch (error: unknown) {
    throw new Error('Failed to issue token', { cause: error });
  }
}

export async function verifyToken(issuer: string, token: string) {
  try {
    return await verify(token, issuer);
  } catch (error: unknown) {
    throw new Error('Failed to verify token', { cause: error });
  }
}

export const issueToken = (async (
  _client: Client,
  { sub }: User,
  request: OAuth2Req,
  done,
) => {
  try {
    const scope = request.scope.join(' ');
    // TODO: Fill out user info
    const token = await getToken(request.authInfo.issuer, { scope, sub });
    // eslint-disable-next-line unicorn/no-null
    done(null, token, { expires_in: tokenConfig.expiresIn });
  } catch (error: unknown) {
    done(error as Error);
  }
}) satisfies IssueGrantTokenFunctionArity4;

interface CodePayload {
  issuer: string;
  user: User['sub'];
  scope: string;
}

const authCode = config.get('auth.code');
const codeKey = await getSymmetricKey(await authCode.key, authCode.alg);
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
      user: user.sub,
      issuer: request.authInfo.issuer,
      scope: request.scope.join(' '),
    } as const satisfies CodePayload;
    const code = await new EncryptJWT(payload)
      .setProtectedHeader({ alg: 'dir', enc: 'A128CBC-HS256' })
      .setSubject(redirectUri)
      .setAudience(client.client_id)
      .setIssuedAt()
      .setExpirationTime(authCode.expiresIn)
      .encrypt(codeKey);
    // eslint-disable-next-line unicorn/no-null
    done(null, code);
  } catch (error: unknown) {
    done(error as Error);
  }
};

export const exchangeCode: IssueExchangeCodeFunctionArity5<Client> = async (
  client,
  code,
  redirectUri,
  { code_verifier },
  done,
  // eslint-disable-next-line max-params
) => {
  try {
    const { payload } = (await jwtDecrypt(code, codeKey, {
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
            throw new TokenError('Invalid code_verifier', 'invalid_grant');
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
            throw new TokenError('Invalid code_verifier', 'invalid_grant');
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

    const { issuer, user, scope, sub } = payload;
    const auth = new Authorization({
      sub: sub ?? user,
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
};

const deviceCodeExp = config.get('auth.deviceCode.expiresIn') / 1000;
export const issueDeviceCode: IssueDeviceCodeFunction<Client> = async (
  client,
  scope,
  _body,
  { issuer },
  done,
  // eslint-disable-next-line max-params
) => {
  try {
    const { deviceCode, userCode } = await createDeviceCode({
      clientId: client.client_id,
      scope,
    });

    done(undefined, deviceCode, userCode, {
      expires_in: deviceCodeExp,
      toJSON() {
        const verificationUri = new URL(`${this.verification_uri}`, issuer);
        return {
          ...this,
          verification_uri: `${verificationUri}`,
          verification_uri_complete: `${verificationUri}?user_code=${this.user_code}`,
        };
      },
    });
  } catch (error: unknown) {
    done(error as Error);
  }
};

export const activateDeviceCode: ActivateDeviceCodeFunction<
  Client,
  User
> = async (_client, deviceCode, _user, done) => {
  try {
    /*
    Throw new TokenError(
      'Waiting for user activation',
      'authorization_pending',
    );
    */
    const code = await findByDeviceCode(deviceCode);
    // TODO: Approval logic
    await _activateDeviceCode({ ...code, approved: true });
    done();
  } catch (error: unknown) {
    done(error as Error);
  }
};

export const exchangeDeviceCode: ExchangeDeviceCodeFunction<Client> = async (
  client,
  deviceCode,
  _body,
  { issuer },
  done,
  // eslint-disable-next-line max-params
) => {
  try {
    const code = await findByDeviceCode(deviceCode);

    // Get user/scope from DB from user activation?
    const { userId, scope } = await redeem(client.client_id, code);

    const auth = new Authorization({
      client_id: client.client_id,
      sub: userId,
      scope: scope.join(' '),
    });
    const token = await getToken(issuer, { ...auth });
    done(undefined, token);
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
      deviceAuthorization = 'device-authorization',
      activate = 'activate',
    } = {},
  },
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  // eslint-disable-next-line @typescript-eslint/require-await
  fastify.addHook('onRequest', async (request) => {
    const issuer = `${request.protocol}://${request.hostname}/` as const;
    request.authInfo = { issuer };
  });

  // PKCE
  oauth2server.grant(extensions());

  // Device code flow
  oauth2server.grant(
    'urn:ietf:params:oauth:grant-type:device_code',
    oauth2orizeDeviceCode.grant.deviceCode(activateDeviceCode),
  );
  oauth2server.exchange(
    'urn:ietf:params:oauth:grant-type:device_code',
    oauth2orizeDeviceCode.exchange.deviceCode(exchangeDeviceCode),
  );

  if (config.get('auth.oauth2.allowImplicitFlows')) {
    // Implicit flow (token)
    oauth2server.grant(oauth2orize.grant.token(issueToken));
  }

  // Code flow (code)
  oauth2server.grant(oauth2orize.grant.code(issueCode));
  // Code flow exchange
  oauth2server.exchange(oauth2orize.exchange.code(exchangeCode));

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
        // @ts-expect-error IDK
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

  const doDeviceAuthorize = promisifyMiddleware(
    oauth2orizeDeviceCode.middleware.authorization<Client, User>(
      { verificationURI: join(fastify.prefix, activate) },
      issueDeviceCode,
    ),
  );
  fastify.post(deviceAuthorization, async (request, reply) => {
    try {
      await doDeviceAuthorize(
        request as unknown as MiddlewareRequest<Client, User>,
        reply as unknown as ServerResponse,
      );
    } catch (error: unknown) {
      request.log.error(error, 'OAuth2 device authorization error');
      await doErrorHandlerDirect(
        error as Error,
        request as unknown as MiddlewareRequest,
        reply as unknown as ServerResponse,
      );
    }
  });

  fastify.get(activate, async (_request, _reply) => {});
};

export default plugin;
