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

'use strict';

const oauth2orizeOpenId = require('oauth2orize-openid');

const utils = require('./utils');

module.exports = function (server) {
  server.grant(oauth2orizeOpenId.extensions());

  // Implict flow (id_token)
  server.grant(
    oauth2orizeOpenId.grant.idToken((client, user, ares, done) => {
      ares.userinfo = true;
      utils.issueIdToken(client, user, ares, done);
    })
  );

  // Implict flow (id_token token)
  server.grant(
    oauth2orizeOpenId.grant.idTokenToken(utils.issueToken, utils.issueIdToken)
  );

  // Hybrid flow (code id_token)
  server.grant(
    oauth2orizeOpenId.grant.codeIdToken(utils.issueCode, utils.issueIdToken)
  );

  // Hybrid flow (code token)
  server.grant(
    oauth2orizeOpenId.grant.codeToken(utils.issueToken, utils.issueCode)
  );

  // Hybrid flow (code id_token token)
  server.grant(
    oauth2orizeOpenId.grant.codeIdTokenToken(
      utils.issueToken,
      utils.issueCode,
      utils.issueIdToken
    )
  );
};
