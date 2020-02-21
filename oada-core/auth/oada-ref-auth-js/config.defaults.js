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

var path = require('path')
var fs = require('fs')

module.exports = {
  domainsDir: '/domains-enabled',
  auth: {
    init: function () {}, // this will run if you call npm run init.  Replace in your own config with your own init.
    server: {
      jsonSpaces: 2,
      sessionSecret: 'Xka*32F@*!15',
      passwordSalt: '$2a$10$l64QftVz6.7KR5BXNc29IO',
      'port-http': 80,
      'port-https': 443,
      mode: 'https',
      domain: 'localhost',
      publicUri: undefined
    },
    wkj: undefined,
    endpointsPrefix: '', // so you can place this under a sub-path in your domain
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
    // Views controls what name is used for the EJS template in the views/ folder for
    // various pages.  For now, there's just login.  In the future can also add the allow
    // page.  This allows other services to override the login page itself with their
    // own custom one via docker-compose.
    views: {
      basedir: '/code/auth/oada-ref-auth-js/views',
      loginPage: 'login',
      approvePage: 'approve'
    },
    oauth2: {
      enable: true
    },
    oidc: {
      enable: true
    },
    dynamicRegistration: {
      trustedListLookupTimeout: 5000
    },
    code: {
      length: 25,
      expiresIn: 10
    },
    token: {
      length: 40,
      expiresIn: 3600
    },
    idToken: {
      expiresIn: 3600,
      signKid: 'kjcScjc32dwJXXLJDs3r124sa1'
    },
    certs: {
      key: fs.readFileSync(path.join(__dirname, 'certs/ssl/server.key')),
      cert: fs.readFileSync(path.join(__dirname, 'certs/ssl/server.crt')),
      ca: fs.readFileSync(path.join(__dirname, 'certs/ssl/ca.crt')),
      requestCrt: true,
      rejectUnauthorized: false
    },
    keys: {
      signPems: path.join(__dirname, 'certs/sign/')
    },
    mongo: {
      connectionString: 'localhost/oada-ref-auth'
    },
    datastoresDriver: 'flat',
    hint: {
      username: 'frank',
      password: 'test'
    }
  }
}
