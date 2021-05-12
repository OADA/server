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

'use strict';

const fs = require('fs');
const path = require('path');

const { default: libConfig } = require('@oada/lib-config');

const config = libConfig({
  domainsDir: {
    format: String,
    default: '/oada/services/auth/domains',
  },
  auth: {
    // this will run if you call npm run init.
    // Replace in your own config with your own init.
    //init: {
    //  default: function () {},
    //},
    server: {
      'jsonSpaces': {
        format: 'int',
        default: 2,
      },
      'sessionSecret': {
        format: String,
        sensitive: true,
        default: 'Xka*32F@*!15',
      },
      'passwordSalt': {
        format: String,
        sensitive: true,
        default: '$2a$10$l64QftVz6.7KR5BXNc29IO',
      },
      'port-http': {
        format: 'port',
        default: 80,
      },
      'port-https': {
        format: 'port',
        default: 443,
      },
      'port': {
        format: 'port',
        nullable: true,
        default: null,
        env: 'PORT',
        arg: 'port',
      },
      'mode': {
        format: ['http', 'https'],
        default: 'https',
      },
      'domain': {
        format: String,
        default: 'localhost',
        env: 'DOMAIN',
        arg: 'domain',
      },
      'publicUri': {
        format: 'url',
        default: null,
      },
    },
    wkj: {
      default: null,
    },
    endpointsPrefix: {
      doc: 'So you can place this under a sub-path in your domain',
      format: String,
      default: '',
    },
    endpoints: {
      register: {
        format: String,
        default: '/register',
      },
      authorize: {
        format: String,
        default: '/auth',
      },
      token: {
        format: String,
        default: '/token',
      },
      decision: {
        format: String,
        default: '/decision',
      },
      login: {
        format: String,
        default: '/login',
      },
      // POST URL for OpenIDConnect domain web form
      loginConnect: {
        format: String,
        default: '/id-login',
      },
      // redirect URL for OpenIDConnect
      redirectConnect: {
        format: String,
        default: '/id-redirect',
      },
      logout: {
        format: String,
        default: '/logout',
      },
      certs: {
        format: String,
        default: '/certs',
      },
      userinfo: {
        format: String,
        default: '/userinfo',
      },
    },
    // Views controls what name is used for the EJS template in the views/ folder for
    // various pages.  For now, there's just login.  In the future can also add the allow
    // page.  This allows other services to override the login page itself with their
    // own custom one via docker-compose.
    views: {
      basedir: {
        format: String,
        default: '/oada/services/auth/views',
      },
      loginPage: {
        format: String,
        default: 'login',
      },
      approvePage: {
        format: String,
        default: 'approve',
      },
    },
    oauth2: {
      enable: {
        format: Boolean,
        default: true,
      },
    },
    oidc: {
      enable: {
        format: Boolean,
        default: true,
      },
    },
    dynamicRegistration: {
      trustedListLookupTimeout: {
        format: 'duration',
        default: 5000,
      },
    },
    code: {
      length: {
        format: 'nat',
        default: 25,
      },
      expiresIn: {
        format: 'duration',
        default: 10,
      },
    },
    token: {
      length: {
        format: 'nat',
        default: 40,
      },
      expiresIn: {
        format: 'duration',
        default: 0,
      },
    },
    idToken: {
      expiresIn: 0,
      signKid: 'kjcScjc32dwJXXLJDs3r124sa1',
    },
    certs: {
      key: {
        default: fs.readFileSync(path.join(__dirname, 'certs/ssl/server.key')),
      },
      cert: {
        default: fs.readFileSync(path.join(__dirname, 'certs/ssl/server.crt')),
      },
      ca: {
        default: fs.readFileSync(path.join(__dirname, 'certs/ssl/ca.crt')),
      },
      requestCrt: {
        format: Boolean,
        default: true,
      },
      rejectUnauthorized: {
        format: Boolean,
        default: false,
      },
    },
    keys: {
      signPems: {
        default: path.join(__dirname, 'certs/sign/'),
      },
    },
    mongo: {
      connectionString: {
        format: String,
        default: 'localhost/oada-ref-auth',
      },
    },
    datastoresDriver: {
      format: fs.readdirSync(path.join(__dirname, 'db')),
      default: 'flat',
    },
    hint: {
      username: {
        format: String,
        default: 'frank',
      },
      password: {
        format: String,
        sensitive: true,
        default: 'test',
      },
    },
  },
});

// Set port default based on mode?
if (config.get('auth.server.port') === null) {
  switch (config.get('auth.server.mode')) {
    case 'https':
      config.set('auth.server.port', 443);
      break;
    case 'http':
      config.set('auth.server.port', 80);
      break;
  }
}

module.exports = config;
