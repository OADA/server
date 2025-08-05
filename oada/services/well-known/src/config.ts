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

/* eslint-disable @typescript-eslint/ban-types, unicorn/no-null */

import libConfig from '@oada/lib-config';

export const { config, schema } = await libConfig({
  trustProxy: {
    format: Array,
    default: ['uniquelocal'],
    env: 'TRUST_PROXY',
    arg: 'trust-proxy',
  },
  wellKnown: {
    'server': {
      port: {
        format: 'port',
        default: 443,
        env: 'PORT',
      },
      mode: {
        format: ['https', 'http'],
        default: 'https',
      },
      domain: {
        format: String,
        default: 'localhost',
        env: 'DOMAIN',
      },
      path_prefix: {
        format: String,
        default: '',
      },
      // Supply SSL certs here in to use HTTPS without reverse proxy...
      certs: {
        format: Object,
        default: {
          // Key: fs.readFileSync(path.join(__dirname, '../certs/ssl/server.key')),
          key: null,
          /*
          Cert: fs.readFileSync(
            path.join(__dirname, '../certs/ssl/server.crt')
          ),
          */
          cert: null,
          // Ca: fs.readFileSync(path.join(__dirname, '../certs/ssl/ca.crt')),
          ca: null,
          requestCrt: true,
        },
      },
    },
    'mergeSubServices': {
      format: Array,
      default: [] as Array<
        | {
            base: string;
            addPrefix?: string;
          }
        | string
      >,
      env: 'WELLKNOWN_SUBSERVICES',
      arg: 'wellknown-subservices',
    },
    'openid-configuration': {
      format: Object,
      default: {
        well_known_version: '1.1.0',
        oada_version: '0.1.0', // Override the version in oada.config.js
        oada_base_uri: null as string | null,
        scopes_supported: [
          {
            'name': 'oada.all.1', // Can do anything the user can do
            /* pattern: /oada\..*\.1/  */
            'read+write': true, // Can read/write anything the user can read/write
          },
        ],
      },
    },
  },
});

const server = config.get('wellKnown.server');

if (!config.get('wellKnown.openid-configuration.oada_base_uri')) {
  config.set(
    'wellKnown.server.openid-configuration.oada_base_uri',
    // eslint-disable-next-line sonarjs/no-nested-template-literals
    `${server.mode}//${server.domain}${server.port ? `:${server.port}` : ''}${
      server.path_prefix ?? ''
    }`,
  );
}
