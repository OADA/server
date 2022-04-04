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

import { KafkaError } from '@oada/lib-kafka';
import { pino } from '@oada/pino-debug';

import { plugin as formats } from '@oada/formats-server';

import tokenLookup, { TokenResponse } from './tokenLookup.js';
import authorizations from './authorizations.js';
import config from './config.js';
import resources from './resources.js';
import users from './users.js';
import websockets from './websockets.js';

import type { HTTPVersion, Handler } from 'find-my-way';
import fastify, { FastifyRequest } from 'fastify';
import bearerAuth from 'fastify-bearer-auth';
import cors from 'fastify-cors';
import esMain from 'es-main';
import fastifyAccepts from 'fastify-accepts';
import fastifyGracefulShutdown from 'fastify-graceful-shutdown';
import fastifyHealthcheck from 'fastify-healthcheck';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import fastifySensible from 'fastify-sensible';
import helmet from 'fastify-helmet';

/**
 * Supported values for X-OADA-Ensure-Link header
 */
export enum EnsureLink {
  Versioned = 'versioned',
  Unversioned = 'unversioned',
}

const logger = pino({ name: 'http-handler' });
export const app = fastify({
  logger,
  ignoreTrailingSlash: true,
  constraints: {
    oadaEnsureLink: {
      name: 'oadaEnsureLink',
      storage() {
        const handlers: Map<unknown, Handler<HTTPVersion.V1>> = new Map();
        let regexHandlers: {
          pattern: RegExp,
          handler: Handler<HTTPVersion.V1>
        }[] = [];
        return {
          get(key) {
            // eslint-disable-next-line unicorn/no-null
            return (
              handlers.get(key) ||
              regexHandlers
                .find((i: { pattern: RegExp, handler: Handler<HTTPVersion.V1> }) => {
                  return i.pattern.test(String(key));
                })?.handler
            ) ?? null;
          },
          set(key, value) {
            if (key instanceof RegExp) {
              regexHandlers.push({
                pattern: key,
                handler: value,
              });
            } else {
              handlers.set(key, value);
            }
          },
          del(key) {
            if (key instanceof RegExp) {
              regexHandlers = regexHandlers.filter(({ pattern }) => {
                return String(pattern) !== String(key);
              });
            } else {
              handlers.delete(key);
            }
          },
          empty() {
            handlers.clear();
            regexHandlers = [];
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

declare module 'fastify-request-context' {
  interface RequestContextData {
    // Add graph lookup result to request context
    user: TokenResponse['doc'];
  }
}

/* eslint no-process-exit: off */

async function init(): Promise<void> {
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

  await app.register(fastifyRequestContextPlugin, {
    hook: 'onRequest',
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
      async auth(token, request: FastifyRequest) {
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

          request.requestContext.set('user', tok.doc);

          return true;
        } catch (error: unknown) {
          request.log.error(error);
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
        const user = request.requestContext.get('user')!;
        return user.bookmarks_id;
      },
    });

    /**
     * Route /shares to resources?
     */
    await aApp.register(resources, {
      prefix: '/shares',
      prefixPath(request) {
        const user = request.requestContext.get('user')!;
        return user.shares_id;
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
      app.log.error(error);
      // eslint-disable-next-line unicorn/no-process-exit
      process.exit(1);
    }
  }
}

/**
 * Try to cleanup and always die on unexpected error
 */
async function close(error: Error): Promise<void> {
  try {
    app.log.error(error, 'Attempting to cleanup server after error.');
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

void init();
