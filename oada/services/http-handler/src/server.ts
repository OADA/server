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
import { KafkaError } from '@oada/lib-kafka';

import { plugin as formats } from '@oada/formats-server';

import tokenLookup, { TokenResponse } from './tokenLookup.js';
import authorizations from './authorizations.js';
import { config } from './config.js';
import resources from './resources.js';
import users from './users.js';
import websockets from './websockets.js';

import fastify, { FastifyRequest } from 'fastify';
import {
  fastifyRequestContextPlugin,
  requestContext,
} from '@fastify/request-context';
import bearerAuth from '@fastify/bearer-auth';
import cors from '@fastify/cors';
import fastifyAccepts from '@fastify/accepts';
import fastifyGracefulShutdown from 'fastify-graceful-shutdown';
import fastifyHealthcheck from 'fastify-healthcheck';
import fastifySensible from '@fastify/sensible';
import helmet from '@fastify/helmet';

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

mixins.push(() => ({
  reqId: requestContext.get('id'),
}));

export const app = fastify({
  logger,
  ignoreTrailingSlash: true,
  constraints: {
    oadaEnsureLink: {
      name: 'oadaEnsureLink',
      storage() {
        const handlers: Map<unknown, Handler<HTTPVersion.V1>> = new Map();
        // eslint-disable-next-line @typescript-eslint/ban-types
        let defaultHandler: Handler<HTTPVersion.V1> | null = null;
        return {
          get(key) {
            return handlers.get(key) ?? defaultHandler;
          },
          set(key, value) {
            if (key === true) {
              defaultHandler = value;
            } else {
              handlers.set(key, value);
            }
          },
          del(key) {
            if (key === true) {
              defaultHandler = null;
            } else {
              handlers.delete(key);
            }
          },
          empty() {
            handlers.clear();
            defaultHandler = null;
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
  app.addHook('onSend', async (request, reply, payload) => {
    await reply.header('X-Request-Id', request.id);
    return payload;
  });
}

export async function start(): Promise<void> {
  await app.listen(config.get('server.port'), '0.0.0.0');
  app.log.info('OADA Server started on port %d', config.get('server.port'));
}

declare module '@fastify/request-context' {
  interface RequestContextData {
    id: string;
  }
}

app.decorateRequest('user', null);
declare module 'fastify' {
  interface FastifyRequest {
    user: TokenResponse['doc'];
  }
}

await app.register(fastifyRequestContextPlugin, {
  hook: 'onRequest',
});

// Add id to request context
app.addHook('onRequest', async (request) => {
  request.requestContext.set('id', request.id);
});

await app.register(fastifySensible, {
  // Hide internal error cause from clients except in development
  errorHandler: process.env.NODE_ENV === 'development' ? false : undefined,
});

await app.register(fastifyAccepts);

await app.register(fastifyGracefulShutdown);

/**
 * @todo restrict this to localhost?
 */
await app.register(fastifyHealthcheck, {
  exposeUptime: process.env.NODE_ENV === 'development',
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
const { errorHandler } = app;
app.setErrorHandler(async (error, request, reply) => {
  errorHandler(error, request, reply);
  // TODO: Make kafka plugin for server?
  if (error instanceof KafkaError) {
    // Kill the server on Kafka Errors?
    await close(error);
  }
});

await app.register(helmet, {
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
});

app.get('/favicon.ico', async (_request, reply) => reply.send());

// Turn on CORS for all domains, allow the necessary headers
await app.register(cors, {
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
await app.register(formats);

/**
 * Handle WebSockets
 *
 * @todo Require token for connecting WebSockets?
 */
await app.register(websockets);

/**
 * Create context for authenticated stuff
 */
await app.register(async (aApp) => {
  await aApp.register(bearerAuth, {
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
        request.log.error({ error });
        return false;
      }
    },
  });

  /**
   * Route /bookmarks to resources?
   */
  await aApp.register(resources, {
    prefix: '/bookmarks',
    prefixPath(request) {
      return request.user?.bookmarks_id ?? '/bookmarks';
    },
  });

  /**
   * Route /shares to resources?
   */
  await aApp.register(resources, {
    prefix: '/shares',
    prefixPath(request) {
      return request.user?.shares_id ?? '/shares';
    },
  });

  /**
   * Handle /resources
   */
  await aApp.register(resources, {
    prefix: '/resources',
    prefixPath() {
      return 'resources';
    },
  });

  /**
   * Handle /users
   */
  await aApp.register(users, {
    prefix: '/users',
  });

  /**
   * Handle /authorizations
   */
  await aApp.register(authorizations, {
    prefix: '/authorizations',
  });
});

if (esMain(import.meta)) {
  try {
    await start();
  } catch (error: unknown) {
    // eslint-disable-next-line unicorn/consistent-destructuring
    app.log.error({ error });
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
    app.log.error({ error }, 'Attempting to cleanup server after error.');
    // Try to close server nicely
    await app.close();
  } finally {
    // Always exit
    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(1);
  }
}

process.on('uncaughtException', close);
process.on('unhandledRejection', close);
