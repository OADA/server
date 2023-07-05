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

import { mixins, pino } from '@oada/pino-debug';

import { config, domainConfigs } from './config.js';

import '@oada/lib-prom';

import path from 'node:path';
import { randomBytes } from 'node:crypto';
import url from 'node:url';

import {
  fastify as Fastify,
  type FastifyPluginAsync,
  type FastifyReply,
  type FastifyRequest,
} from 'fastify';
import {
  fastifyRequestContext,
  requestContext,
} from '@fastify/request-context';
import type FastifyRateLimit from '@fastify/rate-limit';
import _fastifyGracefulShutdown from 'fastify-graceful-shutdown';
import cors from '@fastify/cors';
import { createServer } from 'oauth2orize';
import ejs from 'ejs';
import fastifyFormbody from '@fastify/formbody';
import fastifyHealthcheck from 'fastify-healthcheck';
import fastifySecureSession from '@fastify/secure-session';
import fastifySensible from '@fastify/sensible';
import fastifyStatic from '@fastify/static';
import fastifyView from '@fastify/view';
import helmet from '@fastify/helmet';

import esMain from 'es-main';
import qs from 'qs';

import { type Client, findById } from './db/models/client.js';
import dynReg from './dynReg.js';
import { fastifyPassport } from './auth.js';
import login from './login.js';
import oauth2 from './oauth2.js';
import oidc from './oidc.js';

/**
 * Workaround for default exports/esm nonsense
 * @internal
 */
// HACK: Workaround for default exports/esm nonsense
export function _defaultHack<D>(original: { default: D }) {
  return original as unknown as D;
}

const fastifyGracefulShutdown = _defaultHack(_fastifyGracefulShutdown);

declare module '@fastify/request-context' {
  interface RequestContextData {
    id: string;
  }
}

declare module '@fastify/secure-session' {
  interface SessionData {
    errormsg: string;
    returnTo: string;
    domain_hint: string;
  }
}
const trustProxy = config.get('trustProxy');

async function makeRedis(uri: string) {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const { Redis } = await import('ioredis');
  return new Redis(uri, {
    connectTimeout: 500,
    maxRetriesPerRequest: 1,
  });
}

/**
 * Fastify plugin implementing the OADA auth server
 */
const plugin: FastifyPluginAsync = async (fastify) => {
  const {
    /**
     * Auth API endpoints
     */
    endpoints,
    server: {
      session: {
        key,
        secret,
        // Generate a default salt if key is unset
        salt = key ? undefined : randomBytes(16),
      },
      ...server
    },
    views,
  } = config.get('auth');

  const oauth2server = createServer();
  oauth2server.serializeClient((client: Client, done) => {
    done(null, client.client_id);
  });
  oauth2server.deserializeClient(async (id, done) => {
    try {
      const out = await findById(id);
      done(null, out);
    } catch (error: unknown) {
      done(error as Error);
    }
  });

  await fastify.register(fastifySecureSession, {
    key,
    secret,
    salt,
    cookie: {
      httpOnly: process.env.NODE_ENV !== 'development',
    },
  });

  await fastify.register(fastifyFormbody, {
    parser: (query) => qs.parse(query),
  });

  const { enabled, maxRequests, timeWindow, redis, useDraftSpec } =
    server.rateLimit;
  if (enabled) {
    const { default: fastifyRateLimit } = (await import(
      '@fastify/rate-limit'
    )) as unknown as typeof FastifyRateLimit; // HACK:  Workaround for default exports/esm nonsense
    await fastify.register(fastifyRateLimit, {
      max: maxRequests,
      timeWindow,
      redis: redis ? await makeRedis(redis) : null,
      enableDraftSpec: useDraftSpec,
    });
  }

  await fastify.register(fastifyRequestContext, {
    hook: 'onRequest',
  });

  // Add id to request context
  fastify.addHook('onRequest', async (request) => {
    requestContext.set('id', request.id as string);
  });

  await fastify.register(fastifySensible);

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

  await fastify.register(helmet, {
    crossOriginResourcePolicy: {
      policy: 'cross-origin',
    },
  });

  // Turn on CORS for all domains, allow the necessary headers
  await fastify.register(cors, {
    strictPreflight: false,
    exposedHeaders: ['location', 'content-location'],
  });

  await fastify.register(fastifyView, {
    engine: { ejs },
    root: views.basedir,
  });

  if (process.env.NODE_ENV !== 'production') {
    // Add request id header for debugging purposes
    fastify.addHook('onSend', async (request, reply, payload) => {
      void reply.header('X-Request-Id', request.id);
      return payload;
    });
  }

  await fastify.register(fastifyStatic, {
    root: path.join(
      path.dirname(url.fileURLToPath(import.meta.url)),
      '..',
      'public',
    ),
  });
  // Statically serve all the domains-enabled/*/auth-www folders:
  for await (const domain of domainConfigs.keys()) {
    const onDisk = `${config.get('domainsDir')}/${domain}/auth-www`;
    const webpath = `domains/${domain}`;
    fastify.log.trace(
      `Serving domain ${domain}/auth-www statically, on disk = ${onDisk}, webpath = ${webpath}`,
    );
    await fastify.register(fastifyStatic, {
      prefix: webpath,
      root: onDisk,
      decorateReply: false,
    });
  }

  await fastify.register(fastifyPassport.initialize());
  await fastify.register(fastifyPassport.secureSession());

  // ----------------------------------------------------------------
  // Local user login/logout:
  await fastify.register(login, { endpoints });
  await fastify.register(async (instance) => {
    // Ensure that the local user is authenticated before proceeding
    instance.addHook('preHandler', async (request, reply) => {
      const authenticated = request.isAuthenticated();
      request.log.debug(
        { req: request, authenticated },
        'Checking if user is authenticated',
      );
      if (!authenticated) {
        request.session.set('returnTo', request.url);
        return reply.redirect(endpoints.login);
      }
    });

    if (config.get('auth.oauth2.enable') || config.get('auth.oidc.enable')) {
      await fastify.register(oauth2, { oauth2server, endpoints });
    }
  });

  // ----------------------------------------------------------------
  // Dynamic client registration:
  await fastify.register(dynReg, { endpoints });

  if (config.get('auth.oidc.enable')) {
    await fastify.register(oidc, { oauth2server, endpoints });
  }
};

export async function start(): Promise<void> {
  // Set up logging stuff
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
        session: request.session?.data(),
      };
    },
    // Customize logging for responses
    res(reply: FastifyReply) {
      return {
        statusCode: reply.statusCode,
        location: reply.getHeader('location'),
        contentLocation: reply.getHeader('content-location'),
      };
    },
  };
  const logger = pino({ serializers });
  // HACK: fastify overrides existing serializers. This circumvents that...
  // logger.serializers = serializers;

  mixins.push(() => ({
    reqId: requestContext.get('id'),
  }));

  // eslint-disable-next-line new-cap
  const fastify = Fastify({
    trustProxy,
    logger,
    ignoreTrailingSlash: true,
  });

  try {
    const port = config.get('auth.server.port');
    await fastify.register(plugin, {
      prefix: config.get('auth.endpointsPrefix'),
    });

    fastify.log.info('OADA server starting on port %d', port);
    await fastify.listen({
      port,
      host: '::',
    });
    if (logger.isLevelEnabled('debug')) {
      const routes = fastify.printRoutes();
      fastify.log.debug({ fastify }, `Server running\n${routes}`);
    }
  } catch (error: unknown) {
    fastify.log.fatal(error, 'Failed to start server');
    throw error as Error;
  }
}

if (esMain(import.meta)) {
  try {
    await start();
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error(error);
    // eslint-disable-next-line unicorn/no-process-exit, no-process-exit
    process.exit(1);
  }
}

export default start;
