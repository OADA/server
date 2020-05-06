/* Copyright 2014 Open Ag Data Alliance
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

'use strict'

const domain = process.env.DOMAIN || 'localhost'

/* eslint indent: "off" */
module.exports = {
  // By default, this checks for NODE_ENV===production
  // to determine if is production.
  // set to true to use the production database name
  // and prevent init.cleanup() from being called.
  isProduction: process.env.NODE_ENV === 'production',

  domainsDir: '/domains-enabled', // served by auth for login pages, software statements, keys, etc.

  arangodb: {
    connectionString: 'http://arangodb:8529',
    database: 'oada',
    // Important: ensureDefaults has the potential to delete particular documents from the database
    // if it is set to false.  This ensures dummy users/tokens don't end up in production.
    // For dev, you want this to be true to populate database with dummy data, users, tokens, etc.
    ensureDefaults: false,
    collections: {
      users: {
        name: 'users',
        indexes: ['username', { name: 'oadaid', sparse: true }],
        defaults: './libs/exampledocs/users'
      },
      clients: {
        name: 'clients',
        indexes: ['clientId'],
        defaults: './libs/exampledocs/clients'
      },
      authorizations: {
        name: 'authorizations',
        indexes: ['token', { name: 'user', unique: false }],
        defaults: './libs/exampledocs/authorizations'
      },
      changes: {
        name: 'changes',
        indexes: [{ name: ['resource_id', 'number'], unique: false }],
        defaults: './libs/exampledocs/changes'
      },
      codes: {
        name: 'codes',
        indexes: ['code'],
        defaults: './libs/exampledocs/codes'
      },
      resources: {
        name: 'resources',
        indexes: [],
        defaults: './libs/exampledocs/resources'
      },
      remoteResources: {
        name: 'remoteResources',
        indexes: [{ name: ['domain', 'resource_id'], unique: true }]
      },
      graphNodes: {
        name: 'graphNodes',
        indexes: [{ name: 'resource_id', unique: false }],
        defaults: './libs/exampledocs/graphNodes'
      },
      changeEdges: {
        name: 'changeEdges',
        indexes: [],
        edgeCollection: true,
        defaults: './libs/exampledocs/changeEdges'
      },
      edges: {
        name: 'edges',
        indexes: [
          // TODO: Do we need both these indexes?
          { name: 'name', unique: false },
          { name: ['_from', 'name'], unique: true }
        ],
        defaults: './libs/exampledocs/edges',
        edgeCollection: true
      },
      putBodies: {
        name: 'putBodies',
        indexes: [],
        defaults: './libs/exampledocs/putBodies',
        createOptions: { isVolatile: false }
      },
      sessions: {
        name: 'sessions',
        indexes: [],
        createOptions: { isVolatile: false }
      }
    },
    init: {
      // NOTE: passwordSalt HAS to match the one in auth
      passwordSalt: '$2a$10$l64QftVz6.7KR5BXNc29IO'
    }
  },
  kafka: {
    topics: {
      tokenRequest: 'token_request',
      graphRequest: 'graph_request',
      writeRequest: 'write_request',
      websocketsRequest: 'websockets_request',
      userRequest: 'user_request',
      permissionsRequest: 'permissions_request', //show bobs
      httpResponse: 'http_response',
      websocketsRequest: 'websockets_request'
    }
  },
  zookeeper: {
    host: 'zookeeper:2181'
  },
  auth: {
    // Prefix should match nginx proxy's prefix for the auth service
    endpointsPrefix: '/oadaauth',
    endpoints: {
      register: '/register',
      authorize: '/auth',
      token: '/token',
      decision: '/decision',
      login: '/login',
      loginConnect: '/id-login', // POST URL for OpenIDConnect domain web form
      redirectConnect: '/id-redirect', // redirect URL for OpenIDConnect
      logout: '/logout',
      certs: '/certs',
      userinfo: '/userinfo'
    },
    serviceName: 'Trellis',
    serviceLongName: 'Trellis - A Framework for Produce Audit Data',
    server: {
      // Replace these in production with things that are actually secret...
      sessionSecret: '2jp901p3#2#(!)kd9',
      passwordSalt: '$2a$06$xbh/gQcEgAX5eapjlCgMYO',
      'port-http': 80,
      mode: 'http',
      proxy: 'uniquelocal',
      domain: domain, // in docker it's port 80 localhost
      // but to nginx proxy, it's https://localhost in dev
      publicUri: 'https://' + domain
    },
    keys: {
      signPems: '/code/auth/sign/'
    },
    idToken: {
      expiresIn: 3600,
      // Note: signKid has to match the name of the .pem at the signPem path above
      signKid: '02llkjf92jieiekk2'
    },
    datastoresDriver: 'arango',
    hint: {
      username: 'frank',
      password: 'test'
    }
  },
  wellKnown: {
    // forceProtocol: 'https', // use this to force URL's to have https prefix.  Useful when behind a proxy.
    server: {
      port: 80,
      mode: 'http',
      domain: domain
    },
    mergeSubServices: [
      { resource: 'oada-configuration', base: 'http://auth' },
      { resource: 'openid-configuration', base: 'http://auth' }
    ],
    'oada-configuration': {
      well_known_version: '1.1.0',
      oada_version: '2.0.0',
      oada_base_uri: './',
      scopes_supported: [
        {
          name: 'oada.all.1', // can do anything the user can do
          /* pattern: /oada\..*\.1/  */
          'read+write': true // can read/write anything the user can read/write
        }
      ]
    },
    'openid-configuration': {}
  }
}
