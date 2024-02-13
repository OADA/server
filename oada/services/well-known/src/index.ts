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

// -----------------------------------------------------------------------
// This service will provide a cohesive "/.well-known/oada-configuration"
// and "/.well-known/openid-configuration" which is built from any
// global settings merged with the well-known documents of any internal
// microservices.  Each external request to well-known results in
// internal requests to every internal service to retrieve the
// latest well-known documents.

import { join } from 'node:path/posix';

import { pino } from '@oada/pino-debug';

import { config } from './config.js';

import { nstats } from '@oada/lib-prom';

import got from 'got';

import { fastify as Fastify } from 'fastify';
import { Issuer } from 'openid-client';
import { default as accepts } from '@fastify/accepts';
import { default as cors } from '@fastify/cors';
import { default as helmet } from '@fastify/helmet';

import { plugin as formats } from '@oada/formats-server';
import { plugin as wkj } from '@oada/well-known-json';

export async function discoverConfiguration(issuer: string | URL) {
  try {
    try {
      const { metadata } = await Issuer.discover(`${issuer}`);
      return metadata;
    } catch {
      const { metadata } = await Issuer.discover(`https://${issuer}`);
      return metadata;
    }
  } catch {
    fastify.log.error({ issuer }, 'Failed OIDC discovery for issuer');
    return {};
  }
}

const trustProxy = config.get('trustProxy');
// eslint-disable-next-line new-cap
const fastify = Fastify({
  trustProxy,
  logger: pino(),
});

fastify.log.info('Starting server for ./well-known/oada-configuration...');

await fastify.register(helmet, {
  crossOriginResourcePolicy: {
    policy: 'cross-origin',
  },
});

await fastify.register(accepts);

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

/*
// TODO: Less gross fix for Content-Types?
app.get('/.well-known/oada-configuration', (_, response, next) => {
  response.type('application/vnd.oada.oada-configuration.1+json');
  next();
});
*/
await fastify.register(formats);

const issuer = config.get('oidc.issuer');
const configuration = await discoverConfiguration(issuer);

const wellKnownOptions = {
  resources: {
    'oada-configuration': {
      ...config.get('wellKnown.oada-configuration'),
      ...configuration,
    },
  },
};

const subservices = new Set(
  config
    .get('wellKnown.mergeSubServices')
    .map((s) => (typeof s === 'string' ? s : join(s.base, s.addPrefix ?? ''))),
);

// Redirect other OIDC config endpoints to oada-configuration endpoint
await fastify.register(
  async (app) => {
    app.all('/openid-configuration', async (_request, reply) =>
      reply.redirect(301, '/oada-configuration'),
    );
    app.all('/oauth-authorization-server', async (_request, reply) =>
      reply.redirect(301, '/oada-configuration'),
    );
  },
  { prefix: '/.well-known/' },
);

await fastify.register(
  async (app) => {
    app.addHook('preSerialization', async (request, _reply, payload) => {
      // Parse out the '/.well-known' part of the URL, like
      // '/.well-known/oada-configuration' or '/.well-known/openid-configuration'
      //
      // /.well-known/oada-configuration
      const whichdoc = request.url.replace(/^.*(\/.well-known\/.*$)/, '$1');
      // Oada-configuration
      const resource = whichdoc.replace(/^\/.well-known\/(.*)$/, '$1');

      // Reverse-proxy
      const proxy = got.extend({
        headers: {
          'X-Forwarded-Host': request.hostname,
          'X-Forwarded-Proto': request.protocol,
          'X-Forwarded-For': [...(request.ips ?? []), request.ip],
        },
      });
      const rest = await Promise.all(
        Array.from(subservices, async (s) => {
          request.log.trace(
            'Resource (%s) matches subservice entry (%o), retrieving',
            resource,
            s,
          );

          // Request this resource from the subservice:
          const url = join(s, whichdoc);
          request.log.trace('Requesting subservice URL: %s', url);
          try {
            const body = await proxy.get(url).json();
            request.log.trace({ whichdoc, body }, 'Merging in');
            return body;
          } catch (error: unknown) {
            // If failed to return, or json didn't parse:
            request.log.error(error, `The subservice URL ${url} failed`);
            // eslint-disable-next-line unicorn/no-null
            return null;
          }
        }),
      );
      // eslint-disable-next-line @typescript-eslint/ban-types
      return Object.assign(payload as object, ...rest) as unknown;
    });

    // Include well_known_handler AFTER the subservices check so that
    // express does the check prior to the well-known handler responding.
    await fastify.register(wkj, wellKnownOptions);
  },
  // { prefix: '/.well-known' }
);

const stats = nstats();
const plugin = stats.fastify();
plugin[Symbol.for('plugin-meta')].fastify = '>=3.0.0';
await fastify.register(plugin);

const port = config.get('wellKnown.server.port');
await fastify.listen({
  port,
  host: '::',
});

fastify.log.info('OADA well-known server started on port %d', port);
