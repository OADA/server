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

import { mixins, pino } from '@oada/pino-debug';

import { config } from './config.js';

import { KafkaError } from '@oada/lib-kafka';
import { nstats } from '@oada/lib-prom';

import { plugin as formats } from '@oada/formats-server';

import type { TokenResponse } from './tokenLookup.js';
import authorizations from './authorizations.js';
import resources from './resources.js';
import tokenLookup from './tokenLookup.js';
import users from './users.js';
import websockets from './websockets.js';

import type { FastifyReply, FastifyRequest } from 'fastify';
import {
  fastifyRequestContextPlugin,
  requestContext,
} from '@fastify/request-context';
import { fastify as Fastify } from 'fastify';
import bearerAuth from '@fastify/bearer-auth';
import { default as cors } from '@fastify/cors';
import { default as fastifyAccepts } from '@fastify/accepts';
import { default as fastifyGracefulShutdown } from 'fastify-graceful-shutdown';
import { default as fastifyHealthcheck } from 'fastify-healthcheck';
import { default as fastifySensible } from '@fastify/sensible';
import { default as helmet } from '@fastify/helmet';

import type { HTTPVersion, Handler } from 'find-my-way';
import esMain from 'es-main';

/* eslint no-process-exit: off */

/**
 * Supported values for X-OADA-Ensure-Link header
 */
export enum EnsureLink {
  Versioned = 'versioned',
  Unversioned = 'unversioned',
}

// Set up logging stuff
const logger = pino();
const serializers = {
  // Customize logging for requests
  req(request: FastifyRequest) {
    const version = request.headers?.['accept-version'];
    return {
      method: request.method,
      url: request.url,
      version: version ? `${version}` : undefined,
      hostname: request.hostname,
      userAgent: request.headers?.['user-agent'],
      remoteAddress: request.ip,
      remotePort: request.socket?.remotePort,
    };
  },
  // Customize logging for responses
  res(reply: FastifyReply) {
    return {
      statusCode: reply.statusCode,
      contentLocation: reply.getHeader('content-location'),
      rev: reply.getHeader('X-OADA-Rev'),
      pathLeftover: reply.getHeader('X-OADA-Path-Leftover'),
    };
  },
};

mixins.push(() => ({
  reqId: requestContext.get('id'),
}));

const trustProxy = config.get('trustProxy');
// eslint-disable-next-line new-cap
export const fastify = Fastify({
  trustProxy,
  logger: {
    ...logger,
    // HACK: fastify overrides existing serializers. This circumvents that...
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
  // Add request id header for debugging purposes
  fastify.addHook('onSend', async (request, reply, payload) => {
    void reply.header('X-Request-Id', request.id);
    return payload;
  });
}

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
  }
}

fastify.decorateRequest('user', null);
declare module 'fastify' {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  interface FastifyRequest {
    user: TokenResponse['doc'];
  }
}

await fastify.register(fastifyRequestContextPlugin, {
  hook: 'onRequest',
});

// Add id to request context
fastify.addHook('onRequest', async (request) => {
  requestContext.set('id', request.id);
});

await fastify.register(fastifySensible);

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

/**
 * Create context for authenticated stuff
 */
await fastify.register(async (instance) => {
  await instance.register(bearerAuth, {
    keys: new Set<string>(),
    async auth(token: string, request: FastifyRequest) {
      try {
        const tok = await tokenLookup({
          // Connection_id: request.id,
          // domain: request.headers.host,
          token,
        });

        if (!tok.token_exists) {
          request.log.debug('Token does not exist');
          return false;
        }

        if (tok.doc.expired) {
          request.log.debug('Token expired');
          return false;
        }

        request.user = tok.doc;

        return true;
      } catch (error: unknown) {
        request.log.error({ error }, 'Token error');
        return false;
      }
    },
  });

  /**
   * Route /bookmarks to resources?
   */
  await instance.register(resources, {
    prefix: '/bookmarks',
    prefixPath(request) {
      return request.user?.bookmarks_id ?? '/bookmarks';
    },
  });

  /**
   * Route /shares to resources?
   */
  await instance.register(resources, {
    prefix: '/shares',
    prefixPath(request) {
      return request.user?.shares_id ?? '/shares';
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
    // eslint-disable-next-line unicorn/consistent-destructuring
    fastify.log.fatal({ error }, 'Failed to start server');
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
}

/**
 * Try to cleanup and always die on unexpected error
 */
async function close(error: Error): Promise<void> {
  try {
    // eslint-disable-next-line unicorn/consistent-destructuring
    fastify.log.fatal({ error }, 'Attempting to cleanup server after error.');
    // Try to close server nicely
    await fastify.close();
  } finally {
    // Always exit
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
}

process.on('uncaughtException', close);
process.on('unhandledRejection', close);
