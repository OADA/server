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

import { libConfig } from '@oada/lib-config';

const config = libConfig({
  'server': {
    port: {
      format: 'port',
      default: 80,
      env: 'PORT',
      arg: 'port',
    },
    domain: {
      format: String,
      default: 'localhost',
      env: 'DOMAIN',
      arg: 'domain',
    },
    publicUri: {
      format: 'url',
      default: 'https://localhost',
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

export default config;
