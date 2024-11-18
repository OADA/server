/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
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

import { mixins } from '@oada/pino-debug';

import { config } from './config.js';

import { KafkaError } from '@oada/lib-kafka';
import { nstats } from '@oada/lib-prom';
import { users as userDatabase } from '@oada/lib-arangodb';

import { plugin as formats } from '@oada/formats-server';

import auth, { issuer } from './auth.js';
import authorizations from './authorizations.js';
import requester from './requester.js';
import resources from './resources.js';
import users from './users.js';
import websockets from './websockets.js';

import {
  fastify as Fastify,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import {
  fastifyRequestContext,
  requestContext,
} from '@fastify/request-context';
import type { RateLimitPluginOptions } from '@fastify/rate-limit';
import type { TokenClaims } from '@oada/auth';
import cors from '@fastify/cors';
import fastifyAccepts from '@fastify/accepts';
import fastifyGracefulShutdown from 'fastify-graceful-shutdown';
import fastifyHealthcheck from 'fastify-healthcheck';
import fastifySensible from '@fastify/sensible';
import helmet from '@fastify/helmet';

import type { HTTPVersion, Handler } from 'find-my-way';
import type { UserRequest, UserResponse } from '@oada/users';
import User from '@oada/models/user';
import esMain from 'es-main';

declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface FastifyRequest {
    user?: User & TokenClaims;
  }
}

/* eslint no-process-exit: off */

/**
 * Supported values for X-OADA-Ensure-Link header
 */
export enum EnsureLink {
  Versioned = 'versioned',
  Unversioned = 'unversioned',
}

// Set up logging stuff
const serializers = {
  // Customize logging for requests
  req(request: FastifyRequest) {
    const version = request.headers?.['accept-version'];
    return {
      requestId: request.headers?.['x-request-id'],
      method: request.method,
      url: request.url,
      version: version ? `${version}` : undefined,
      hostname: request.hostname,
      userAgent: request.headers?.['user-agent'],
      contentType: request.headers?.['content-type'],
      remoteAddress: request.ip,
      remotePort: request.socket?.remotePort,
    };
  },
  // Customize logging for responses
  res(reply: FastifyReply) {
    return {
      statusCode: reply.statusCode,
      statusText: reply.status,
      contentLocation: reply.getHeader?.('content-location'),
      rev: reply.getHeader?.('X-OADA-Rev'),
      pathLeftover: reply.getHeader?.('X-OADA-Path-Leftover'),
      // @ts-expect-error stuff
      body: reply.body,
    };
  },
};
// HACK: fastify overrides existing serializers. This circumvents that...
// logger.serializers = serializers;

mixins.push(() => ({
  reqId: requestContext.get('id'),
}));

const trustProxy = config.get('trustProxy');

// eslint-disable-next-line new-cap
export const fastify = Fastify({
  trustProxy,
  logger: {
    // @ts-expect-error fastify types bs
    serializers,
  },
  ignoreTrailingSlash: true,
  constraints: {
    oadaEnsureLink: {
      name: 'oadaEnsureLink',
      storage() {
        const handlers = new Map<unknown, Handler<HTTPVersion.V1>>();
        return {
          get(key) {
            // eslint-disable-next-line unicorn/no-null
            return handlers.get(key) ?? handlers.get(true) ?? null;
          },
          set(key, value) {
            handlers.set(key, value);
          },
          del(key) {
            handlers.delete(key);
          },
          empty() {
            handlers.clear();
          },
        };
      },
      validate(_value) {
        /* TODO: Fix this?
        if (!Object.keys(EnsureLink).includes(value as string)) {
          throw new Error(`Invalid  X-OADA-Ensure-Link: ${value}`);
        }
        */
      },
      deriveConstraint(request) {
        return request.headers['x-oada-ensure-link'];
      },
      mustMatchWhenDerived: true,
    },
  },
});

if (process.env.NODE_ENV !== 'production') {
  // Send errors on to client for debug purposes
  fastify.setErrorHandler((error, request, reply) => {
    // @ts-expect-error stuff
    const res = error.response;
    const code = error.statusCode ?? 500;
    request.log.error({ err: error, res });
    void reply.code(code).send(res?.body ?? res);
  });
}

// Add request id header for tracing/debugging purposes
fastify.addHook('onSend', async (request, reply, payload) => {
  void reply.header('X-Request-Id', request.headers['x-request-id']);
  return payload;
});

const port = config.get('server.port');
export async function start(): Promise<void> {
  await fastify.listen({
    port,
    host: '::',
  });
  fastify.log.info('OADA Server started on port %d', port);
}

declare module '@fastify/request-context' {
  interface RequestContextData {
    id: string;
    domain: string;
    issuer: string;
  }
}

async function makeRedis(uri: string) {
  const { Redis } = await import('ioredis');
  return new Redis(uri, {
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
  });
}

const { enabled, maxRequests, timeWindow, redis, useDraftSpec } =
  config.get('server.rateLimit');
if (enabled) {
  const options: RateLimitPluginOptions = {
    keyGenerator(request) {
      const mode = ['PUT', 'POST', 'DELETE'].includes(request.method)
        ? 'write'
        : 'read';
      return `${request.ip}-${mode}`;
    },
    max(request) {
      return ['PUT', 'POST', 'DELETE'].includes(request.method)
        ? maxRequests.write
        : maxRequests.read;
    },
    timeWindow,
    // eslint-disable-next-line unicorn/no-null
    redis: redis ? await makeRedis(redis) : null,
    enableDraftSpec: useDraftSpec,
  };
  const { default: plugin } = await import('@fastify/rate-limit');
  await fastify.register<RateLimitPluginOptions>(plugin, options);
}

await fastify.register(fastifyRequestContext, {
  hook: 'onRequest',
});

// Add id to request context
// eslint-disable-next-line @typescript-eslint/require-await
fastify.addHook('onRequest', async (request) => {
  requestContext.set('id', request.id);
  requestContext.set('domain', request.hostname);
  requestContext.set(
    'issuer',
    `${request.protocol}://${request.hostname}/` as const,
  );
});

await fastify.register(fastifySensible);

// @ts-expect-error types bs
await fastify.register(fastifyAccepts);

await fastify.register(fastifyGracefulShutdown);

/**
 * @todo restrict this to localhost?
 */
await fastify.register(fastifyHealthcheck, {
  exposeUptime: process.env.NODE_ENV !== 'production',
  // By default everything is off, so give numbers to under-pressure
  underPressureOptions: {
    maxEventLoopDelay: 5000,
    // MaxHeapUsedBytes: 100000000,
    // maxRssBytes: 100000000,
    maxEventLoopUtilization: 0.98,
  },
});

/**
 * Try to kill server on Kafka error.
 *
 * This is to handle an intermittent error on sending requests,
 * likely from tulios/kafkajs#979
 */
const { errorHandler } = fastify;
fastify.setErrorHandler(async (error, request, reply) => {
  // @ts-expect-error fastify types bs
  errorHandler(error, request, reply);
  // TODO: Make kafka plugin for server?
  if (error instanceof KafkaError) {
    // Kill the server on Kafka Errors?
    await close(error);
  }
});

await fastify.register(helmet, {
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
});

// Turn on CORS for all domains, allow the necessary headers
await fastify.register(cors, {
  strictPreflight: false,
  exposedHeaders: [
    'x-oada-rev',
    'x-oada-path-leftover',
    'location',
    'content-location',
  ],
});

/**
 * @todo why does onSend never run for us??
 */
await fastify.register(formats);

/**
 * Handle WebSockets
 *
 * @todo Require token for connecting WebSockets?
 */
await fastify.register(websockets);

// TODO: Config/logic to decide if iss is trusted
const TRUSTED_ISSUERS = new Set([`${issuer}`, config.get('oidc.issuer')]);

// eslint-disable-next-line unicorn/prevent-abbreviations
async function enureOIDCUser({ sub, iss: i, ...rest }: TokenClaims) {
  if (!sub) {
    throw new TypeError('OIDC: No sub in claims');
  }

  const reqIss = requestContext.get('issuer')!;
  const iss = i ?? reqIss;

  if (!(TRUSTED_ISSUERS.has(iss) || iss === reqIss)) {
    throw new Error(`Untrusted issuer ${iss}`);
  }

  const u =
    iss === reqIss
      ? await userDatabase.findById(sub)
      : await userDatabase.findByOIDCToken({
          sub,
          iss,
        });

  if (u) {
    return u;
  }

  const user = new User({ ...rest, sub, oidc: [{ sub, iss }] });
  const resp = (await requester.send(
    {
      connection_id: requestContext.get('id'),
      domain: requestContext.get('domain'),
      authorization: {
        scope: ['oada.admin.user:all'],
      },
      user,
    } as UserRequest,
    config.get('kafka.topics.userRequest'),
  )) as UserResponse;
  return resp.user;
}

/**
 * Create context for authenticated stuff
 */
await fastify.register(async (instance) => {
  await fastify.register(auth);
  instance.addHook('onRequest', instance.authenticate);

  // Fetch user info etc. for subject of current token
  instance.addHook('onRequest', async (request, reply) => {
    // TODO: Use an OADA prefix for JWT claims?
    const claims = request.user as unknown as TokenClaims;

    request.log.debug({ claims }, 'Retrieving user info for request');
    if (!request.user?.sub) {
      request.log.error({ claims }, 'No user subject found for request');
      return reply.unauthorized();
    }

    const user = await enureOIDCUser(claims);
    if (!user) {
      request.log.error({ claims }, 'No user found for request');
      return reply.unauthorized();
    }

    request.log.trace({ user }, 'User/Auth info loaded');
    request.user = { ...claims, ...user };
  });

  /**
   * Route /bookmarks to resources?
   */
  await instance.register(resources, {
    prefix: '/bookmarks',
    prefixPath(request) {
      return request.user!.bookmarks._id;
    },
  });

  /**
   * Route /shares to resources?
   */
  await instance.register(resources, {
    prefix: '/shares',
    prefixPath(request) {
      return request.user!.shares._id;
    },
  });

  /**
   * Handle /resources
   */
  await instance.register(resources, {
    prefix: '/resources',
    prefixPath() {
      return 'resources';
    },
  });

  /**
   * Handle /users
   */
  await instance.register(users, {
    prefix: '/users',
  });

  /**
   * Handle /authorizations
   */
  await instance.register(authorizations, {
    prefix: '/authorizations',
  });
});

const stats = nstats(fastify.websocketServer);
const plugin = stats.fastify();

plugin[Symbol.for('plugin-meta')].fastify = '>=3.0.0';
await fastify.register(plugin);

if (esMain(import.meta)) {
  try {
    await start();
  } catch (error: unknown) {
    fastify.log.fatal({ error }, 'Failed to start server');
    // eslint-disable-next-line unicorn/no-process-exit, n/no-process-exit
    process.exit(1);
  }
}

/**
 * Try to cleanup and always die on unexpected error
 */
async function close(error: Error): Promise<void> {
  try {
    fastify.log.fatal(error, 'Attempting to cleanup server after error.');
    // Try to close server nicely
    await fastify.close();
  } finally {
    // Always exit
    // eslint-disable-next-line unicorn/no-process-exit, n/no-process-exit
    process.exit(1);
  }
}

process.on('uncaughtException', (error) => void close(error));
process.on('unhandledRejection', (error) => void close(error as Error));
