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

import libConfig from '@oada/lib-config';

export const { config, schema } = await libConfig({
  'trustProxy': {
    format: Array,
    default: ['uniquelocal'],
    env: 'TRUST_PROXY',
    arg: 'trust-proxy',
  },
  'server': {
    port: {
      format: 'port',
      default: 80,
      env: 'PORT',
      arg: 'port',
    },
    publicUri: {
      format: 'url',
      default: 'https://localhost',
    },
    rateLimit: {
      enabled: {
        doc: 'Have the oada server handle rate-limiting (usually should be handled in a reverse-proxy instead)',
        format: Boolean,
        default: false,
        env: 'RATE_LIMIT_ENABLED',
        arg: 'rate-limit-enabled',
      },
      useDraftSpec: {
        doc: 'see https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-06.txt',
        format: Boolean,
        default: false,
        env: 'RATE_LIMIT_DRAFT_SPEC',
        arg: 'rate-limit-draft-spec',
      },
      maxRequests: {
        read: {
          format: 'int',
          default: 20,
          env: 'MAX_READ_REQUESTS',
          arg: 'max-read-requests',
        },
        write: {
          format: 'int',
          default: 5,
          env: 'MAX_WRITE_REQUESTS',
          arg: 'max-write-requests',
        },
      },
      timeWindow: {
        doc: 'time window in ms to use for rate-limiting',
        format: 'duration',
        default: 1000,
        env: 'RATE_TIME_WINDOW',
        arg: 'rate-time-window',
      },
      redis: {
        doc: 'Redis URI to use for rate-limit storage',
        format: String,
        nullable: true,
        // eslint-disable-next-line @typescript-eslint/ban-types
        default: null as string | null,
        env: 'REDIS_URI',
        arg: 'redis-uri',
      },
    },
  },
  // Prefix should match nginx proxy's prefix for the auth service
  // endpointsPrefix: '/oadaauth',
  'http-handler': {
    websockets: { maxWatches: { format: 'int', default: 100_000 } },
  },
  'kafka': {
    topics: {
      doc: 'Kafka topic names to use',
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      default: {
        tokenRequest: 'token_request',
        graphRequest: 'graph_request',
        writeRequest: 'write_request',
        websocketsRequest: 'websockets_request',
        permissionsRequest: 'permissions_request',
        permissionsResponse: 'permissions_response',
        httpResponse: 'http_response',
      } as Record<string, string>,
    },
  },
  'storage': {
    binary: {
      cacache: {
        format: String,
        default: 'tmp/oada-cache',
      },
    },
  },
});
