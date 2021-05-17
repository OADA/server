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
import bearerAuth, { FastifyBearerAuthOptions } from 'fastify-bearer-auth';
import { fastifyRequestContextPlugin } from 'fastify-request-context';
import helmet from 'fastify-helmet';
import cors from 'fastify-cors';
import middie from 'middie';
// @ts-ignore
import wellKnownJson from 'well-known-json';

import { OADAError } from 'oada-error';

import { pino } from '@oada/pino-debug';

import tokenLookup, { TokenResponse } from './tokenLookup';
import resources from './resources';
import authorizations from './authorizations';
import users from './users';
import config from './config';

const logger = pino({ name: 'http-handler' });
const app = fastify({
  logger,
  ignoreTrailingSlash: true,
});
//const server = http.createServer(app);
//require('./websockets')(server);

app.register(helmet);

app.register(fastifyRequestContextPlugin, {
  hook: 'preValidation',
  defaultStoreValues: {},
});

app.get('/favicon.ico', async (_request, reply) => reply.send());

async function start() {
  await app.listen(config.get('server.port'), '0.0.0.0');
  app.log.info('OADA Server started on port %d', config.get('server.port'));
}

// Turn on CORS for all domains, allow the necessary headers
app.register(
  cors({
    exposedHeaders: [
      'x-oada-rev',
      'x-oada-path-leftover',
      'location',
      'content-location',
    ],
  })
);
//app.options('*', cors());

////////////////////////////////////////////////////////
// Configure the OADA well-known handler middleware
const wellKnownHandler = wellKnownJson({
  headers: {
    'content-type': 'application/vnd.oada.oada-configuration.1+json',
  },
});
//wellKnownHandler.addResource('oada-configuration', config.oada_configuration);

declare module 'fastify-request-context' {}

app.register(bearerAuth, {
  keys: new Set(),
  async auth(token, request: FastifyRequest) {
    try {
      const tok = await tokenLookup({
        //connection_id: request.id,
        //domain: request.headers.host,
        token,
      });

      if (!tok['token_exists']) {
        request.log.debug('Token does not exist');
        throw new OADAError('Unauthorized', 401);
      }
      if (tok.doc.expired) {
        request.log.debug('Token expired');
        throw new OADAError('Unauthorized', 401);
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
} as FastifyBearerAuthOptions);

/**
 * Route /bookmarks to resources?
 */
app.register(resources, {
  prefix: '/bookmarks',
  prefixPath(request) {
    const user = request.requestContext.get<TokenResponse['doc']>('user')!;
    return user.bookmarks_id;
  },
});

/**
 * Route /shares to resources?
 */
app.register(resources, {
  prefix: '/shares',
  prefixPath(request) {
    const user = request.requestContext.get<TokenResponse['doc']>('user')!;
    return user.shares_id;
  },
});

/**
 * Handle /resources
 */
app.register(resources, {
  prefix: '/resources',
  prefixPath() {
    return 'resources/';
  },
});

// TODO: Remove middie once everything is ported
import type { SimpleHandleFunction, NextHandleFunction } from 'connect';
declare module 'fastify' {
  type Handler = SimpleHandleFunction | NextHandleFunction;

  interface FastifyInstance {
    use(fn: Handler): this;
    use(route: string | string[], fn: Handler): this;
  }
}
app.register(middie).then(() => {
  app.use(wellKnownHandler);
  app.use('/authorizations', authorizations);
  app.use('/users', users);
});

if (require.main === module) {
  start().catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
}

export { start };
