/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config } from "./config.js";

import type { FastifyAuthFunction } from "@fastify/auth";
import type { FastifyJWTOptions } from "@fastify/jwt";
import { requestContext } from "@fastify/request-context";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import {
  type FastifyJwtJwksOptions,
  type Authenticate as JWTAuthenticate,
  fastifyJwtJwks,
} from "fastify-jwt-jwks";

import { Issuer } from "openid-client";

import type { TokenClaims } from "@oada/auth";

import tokenLookup from "./tokenLookup.js";

/**
 * Wether to check arango for bearer tokens
 */
const allowLegacyTokens = [config.get("auth.token.dataStore")]
  .flat()
  .includes("arango");

async function discoverConfiguration(uri: string | URL) {
  try {
    try {
      const { metadata, issuer } = await Issuer.discover(`${uri}`);
      return { metadata, issuer };
    } catch {
      const { metadata, issuer } = await Issuer.discover(`https://${uri}`);
      return { metadata, issuer };
    }
  } catch (error: unknown) {
    throw new Error(`Failed OIDC discovery for issuer '${uri}'`, {
      cause: error,
    });
  }
}

// Find JWKSet URI for auth issuer with OIDC
const {
  metadata: { jwks_uri: jwksUrl },
  issuer,
} = await discoverConfiguration(config.get("oidc.issuer"));

export { issuer };

declare module "fastify" {
  interface FastifyInstance {
    [jwtAuthenticate]: JWTAuthenticate;
    [decoratorName]: JWTAuthenticate | FastifyAuthFunction;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: TokenClaims;
    // User: { _id: string };
  }
}
declare module "fastify-jwt-jwks" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface FastifyJwtJwksOptions extends FastifyJWTOptions {}
}

export const decoratorName = "authenticate";

const jwtNamespace = "jwt";
const jwtAuthenticate = `${jwtNamespace}Authenticate`;

/**
 * Fastify plugin for checking auth tokens
 */
const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.log.debug({ issuer, jwksUrl }, "Loaded OIDC configuration");

  await fastify.register(
    fastifyJwtJwks as FastifyPluginAsync<FastifyJwtJwksOptions>,
    {
      namespace: jwtNamespace,
      jwksUrl,
      issuer: [
        `${issuer}`,

        {
          test(value: string) {
            return requestContext.get("issuer") === value;
          },
        } as RegExp,
      ],
      formatUser(claims) {
        fastify.log.debug({ claims }, "JWT claims");
        return claims;
      },
    } as const satisfies FastifyJwtJwksOptions,
  );

  if (allowLegacyTokens) {
    try {
      return await withLegacyAuth();
    } catch (error: unknown) {
      fastify.log.error(error, "Falling back to regular auth");
    }
  }

  // eslint-disable-next-line security/detect-object-injection
  fastify.decorate(decoratorName, fastify[jwtAuthenticate]);

  async function withLegacyAuth() {
    try {
      const { fastifyAuth } = await import("@fastify/auth");
      const { default: bearerAuth } = await import("@fastify/bearer-auth");

      await fastify.register(fastifyAuth);
      // Check for old style bearer token
      await fastify.register(bearerAuth, {
        addHook: false,
        keys: [],
        verifyErrorLogLevel: "debug",
        async auth(token: string, request: FastifyRequest) {
          request.log.trace("Checking for legacy bearer token");
          try {
            const auth = await tokenLookup({
              token,
            });

            if (auth) {
              // @ts-expect-error HACK
              request.user = auth;
              return true;
            }
          } catch (error: unknown) {
            request.log.debug(error, "Token error");
          }

          return false;
        },
      });

      fastify.decorate(
        decoratorName,
        // eslint-disable-next-line security/detect-object-injection
        fastify.auth([fastify[jwtAuthenticate], fastify.verifyBearerAuth!]),
      );
    } catch (error: unknown) {
      throw new Error("Failed enabling legacy auth tokens", { cause: error });
    }
  }
};

// @ts-expect-error Don't create a new scope for auth plugin
plugin[Symbol.for("skip-override")] = true;

export default plugin;
