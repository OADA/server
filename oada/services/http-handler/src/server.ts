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
import fastifySensible from 'fastify-sensible';
import bearerAuth from 'fastify-bearer-auth';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import helmet from 'fastify-helmet';
import cors from 'fastify-cors';
import middie from 'middie';

import { pino } from '@oada/pino-debug';

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

// TODO: Remove middie once everything is ported
import type { SimpleHandleFunction, NextHandleFunction } from 'connect';
declare module 'fastify' {
  type Handler = SimpleHandleFunction | NextHandleFunction;

  interface FastifyInstance {
    use(fn: Handler): this;
    use(route: string | string[], fn: Handler): this;
  }
}
async function init() {
  await app.register(fastifySensible, {
    // Hide internal error cause from clients except in development
    errorHandler: process.env.NODE_ENV === 'development' ? false : undefined,
  });

  await app.register(helmet);

  await app.register(fastifyRequestContextPlugin, {
    hook: 'onRequest',
    defaultStoreValues: {},
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
          // TODO: Why both??
          request.requestContext.set('user', tok.doc);
          request.requestContext.set('authorization', tok.doc); // for users handler

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
        const user = request.requestContext.get<TokenResponse['doc']>('user')!;
        return user.bookmarks_id;
      },
    });

    /**
     * Route /shares to resources?
     */
    await app.register(resources, {
      prefix: '/shares',
      prefixPath(request) {
        const user = request.requestContext.get<TokenResponse['doc']>('user')!;
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

    await app.register(middie);
    app.use('/authorizations', authorizations);
    app.use('/users', users);
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

init();
