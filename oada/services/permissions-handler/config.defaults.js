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

module.exports = {
  // By default, this checks for NODE_ENV===production
  // to determine if is production.
  // set to true to use the production database name
  // and prevent init.cleanup() from being called.
  isProduction: process.env.NODE_ENV === 'production',

  kafka: {
    topics: {
      permissionsRequest: 'permissions_request',
      tokenRequest: 'token_request',
      graphRequest: 'graph_request',
      writeRequest: 'write_request',
      httpResponse: 'http_response',
    },
    groupId: 'permissions',
  },
};
