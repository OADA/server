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

// @ts-check

import process from 'node:process';

const domain = process.env.DOMAIN ?? 'localhost';

export default {
  domainsDir: '/oada/services/auth/domains', // Served by auth for login pages, software statements, keys, etc.

  server: {
    port: 8080,
    mode: 'http',
  },

  storage: {
    binary: {
      // TODO: Where should this live??
      cacache: '/oada/binary',
    },
  },

  arangodb: {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols
    connectionString: 'http://arangodb:8529',
    database: 'oada',
    // Important: ensureDefaults has the potential to delete particular documents from the database
    // if it is set to false.  This ensures dummy users/tokens don't end up in production.
    // For dev, you want this to be true to populate database with dummy data, users, tokens, etc.
    ensureDefaults: false,
    collections: {
      users: {
        name: 'users',
        indexes: ['username', { name: 'oadaid', sparse: true }, 'sub', 'iss'],
        defaults: './libs/exampledocs/users.js',
      },
      clients: {
        name: 'clients',
        indexes: ['clientId'],
        defaults: './libs/exampledocs/clients.js',
      },
      authorizations: {
        name: 'authorizations',
        indexes: ['token', { name: 'user', unique: false }],
        defaults: './libs/exampledocs/authorizations.js',
      },
      changes: {
        name: 'changes',
        indexes: [{ name: ['resource_id', 'number'], unique: false }],
        defaults: './libs/exampledocs/changes.js',
      },
      codes: {
        name: 'codes',
        indexes: ['code'],
        defaults: './libs/exampledocs/codes.js',
      },
      resources: {
        name: 'resources',
        indexes: [],
        defaults: './libs/exampledocs/resources.js',
      },
      remoteResources: {
        name: 'remoteResources',
        indexes: [{ name: ['domain', 'resource_id'], unique: true }],
      },
      graphNodes: {
        name: 'graphNodes',
        indexes: [{ name: 'resource_id', unique: false }],
        defaults: './libs/exampledocs/graphNodes.js',
      },
      changeEdges: {
        name: 'changeEdges',
        indexes: [],
        edgeCollection: true,
        defaults: './libs/exampledocs/changeEdges.js',
      },
      edges: {
        name: 'edges',
        indexes: [
          // TODO: Do we need both these indexes?
          { name: 'name', unique: false },
          { name: ['_from', 'name'], unique: true },
        ],
        defaults: './libs/exampledocs/edges.js',
        edgeCollection: true,
      },
      putBodies: {
        name: 'putBodies',
        indexes: [],
        defaults: './libs/exampledocs/putBodies.js',
        createOptions: { isVolatile: false },
      },
    },
  },
  kafka: {
    broker: 'kafka:9092',
    topics: {
      tokenRequest: 'token_request',
      graphRequest: 'graph_request',
      writeRequest: 'write_request',
      userRequest: 'user_request',
      permissionsRequest: 'permissions_request',
      httpResponse: 'http_response',
      websocketsRequest: 'websockets_request',
    },
  },
  oidc: {
    issuer: domain,
  },
  auth: {
    // Prefix should match nginx proxy's prefix for the auth service
    endpointsPrefix: '/oadaauth/',
    endpoints: {
      register: 'register',
      authorize: 'auth',
      token: 'token',
      decision: 'decision',
      login: 'login',
      loginConnect: 'id-login', // POST URL for OpenIDConnect domain web form
      logout: 'logout',
      certs: 'certs',
      userinfo: 'userinfo',
    },
    serviceName: 'Trellis',
    serviceLongName: 'Trellis - A Framework for Produce Audit Data',
    server: {
      'port-http': 8080,
      'mode': 'http',
      'proxy': 'uniquelocal',
      domain, // In docker it's port 80 localhost
      // but to nginx proxy, it's https://localhost in dev
      'publicUri': `https://${domain}`,
    },
    keys: {},
    idToken: {
      expiresIn: 3600,
      // Note: signKid has to match the name of the .pem at the signPem path above
      signKid: '02llkjf92jieiekk2',
    },
    datastoresDriver: 'arango',
    hint: {
      username: 'frank',
      // eslint-disable-next-line sonarjs/no-hardcoded-credentials
      password: 'test',
    },
  },
  wellKnown: {
    // ForceProtocol: 'https', // use this to force URL's to have https prefix.  Useful when behind a proxy.
    'server': {
      port: 8080,
      mode: 'http',
      domain,
    },
    'mergeSubServices': [
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      { resource: 'openid-configuration', base: 'http://auth:8080' },
    ],
    'openid-configuration': {
      well_known_version: '1.1.0',

      oada_version: '3.5.1',

      oada_base_uri: './',

      scopes_supported: [
        {
          'name': 'oada.all.1', // Can do anything the user can do
          /* pattern: /oada\..*\.1/  */
          'read+write': true, // Can read/write anything the user can read/write
        },
      ],
    },
  },
};
