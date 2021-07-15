/* Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import fastify, { FastifyRequest } from 'fastify';
import fastifyHealthcheck from 'fastify-healthcheck';
import fastifySensible from 'fastify-sensible';
import fastifyAccepts from 'fastify-accepts';
import fastifyGracefulShutdown from 'fastify-graceful-shutdown';
import bearerAuth from 'fastify-bearer-auth';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import helmet from 'fastify-helmet';
import cors from 'fastify-cors';

import { plugin as formats } from '@oada/formats-server';

import { pino } from '@oada/pino-debug';
import { KafkaError } from '@oada/lib-kafka';

import tokenLookup, { TokenResponse } from './tokenLookup';
import resources from './resources';
import websockets from './websockets';
import authorizations from './authorizations';
import users from './users';
import config from './config';

const logger = pino({ name: 'http-handler' });
export const app = fastify({
  logger,
  ignoreTrailingSlash: true,
});

export async function start() {
  await app.listen(config.get('server.port'), '0.0.0.0');
  app.log.info('OADA Server started on port %d', config.get('server.port'));
}

declare module 'fastify-request-context' {
  interface RequestContextData {
    // Add graph lookup result to request context
    user: TokenResponse['doc'];
  }
}

async function init() {
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
      //maxHeapUsedBytes: 100000000,
      //maxRssBytes: 100000000,
      maxEventLoopUtilization: 0.98,
    },
  });

  /**
   * Try to kill server on Kafka error.
   *
   * This is to handle an intermittent error on sending requests,
   * likely from tulios/kafkajs#979
   */
  app.setErrorHandler(async (err, request, reply) => {
    app.errorHandler(err, request, reply);
    // TODO: Make kafka plugin for server?
    if (err instanceof KafkaError) {
      // Kill the server on Kafka Errors?
      await close(err);
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
  await app.register(async function tokenScope(app) {
    await app.register(bearerAuth, {
      keys: new Set<string>(),
      async auth(token, request: FastifyRequest) {
        try {
          const tok = await tokenLookup({
            //connection_id: request.id,
            //domain: request.headers.host,
            token,
          });

          if (!tok['token_exists']) {
            request.log.debug('Token does not exist');
            return false;
          }
          if (tok.doc.expired) {
            request.log.debug('Token expired');
            return false;
          }
          request.requestContext.set('user', tok.doc);

          return true;
        } catch (err) {
          request.log.error(err);
          return false;
        }
      },
    });

    /**
     * Route /bookmarks to resources?
     */
    await app.register(resources, {
      prefix: '/bookmarks',
      prefixPath(request) {
        const user = request.requestContext.get('user')!;
        return user.bookmarks_id;
      },
    });

    /**
     * Route /shares to resources?
     */
    await app.register(resources, {
      prefix: '/shares',
      prefixPath(request) {
        const user = request.requestContext.get('user')!;
        return user.shares_id;
      },
    });

    /**
     * Handle /resources
     */
    await app.register(resources, {
      prefix: '/resources',
      prefixPath() {
        return 'resources';
      },
    });

    /**
     * Handle /users
     */
    await app.register(users, {
      prefix: '/users',
    });

    /**
     * Handle /authorizations
     */
    await app.register(authorizations, {
      prefix: '/authorizations',
    });
  });

  if (require.main === module) {
    try {
      await start();
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  }
}

/**
 * Try to cleanup and always die on unexpected error
 */
async function close(err: Error) {
  try {
    app.log.error(err, 'Attempting to cleanup server after error.');
    // Try to close server nicely
    await app.close();
  } finally {
    // Always exit
    process.exit(1);
  }
}
process.on('uncaughtException', close);
process.on('unhandledRejection', close);

init();
