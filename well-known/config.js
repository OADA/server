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
'use strict';

var path = require('path');
var fs = require('fs');

const server = {
  port: 80,
  mode: 'http',
  domain: 'localhost',
};

module.exports = {
  server: server,
  mergeSubServices: [
    { resource:   'oada-configuration', base: 'http://auth' },
    { resource: 'openid-configuration', base: 'http://auth' },
  ],
  "oada-configuration": {
    well_known_version: '1.0.0',
    oada_base_uri: server.mode+'//'+server.domain
                  +(server.port ? ':'+server.port : '' )
                  +(server.path_prefix ? server.path_prefix : ''),
    scopes_supported: [
      {
        name: 'oada.all.1', // can do anything the user can do
        /* pattern: /oada\..*\.1/  */
        'read+write': true, // can read/write anything the user can read/write
      }
    ],
  },
  "openid-configuration": { },
};
