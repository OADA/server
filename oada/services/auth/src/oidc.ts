/**
 * @license
 * Copyright 2017-2022 Open Ag Data Alliance
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

import type oauth2orize from 'oauth2orize';
import oauth2orizeOpenId from 'oauth2orize-openid';

import { issueCode, issueIdToken, issueToken } from './utils.js';

function oidc(server: oauth2orize.OAuth2Server) {
  server.grant(oauth2orizeOpenId.extensions());

  // Implicit flow (id_token)
  server.grant(
    oauth2orizeOpenId.grant.idToken((client, user, ares, done) => {
      // @ts-expect-error IDEK
      ares.userinfo = true;
      issueIdToken(client, user, ares, done);
    })
  );

  // Implicit flow (id_token token)
  server.grant(oauth2orizeOpenId.grant.idTokenToken(issueToken, issueIdToken));

  // Hybrid flow (code id_token)
  server.grant(oauth2orizeOpenId.grant.codeIdToken(issueCode, issueIdToken));

  // Hybrid flow (code token)
  server.grant(oauth2orizeOpenId.grant.codeToken(issueToken, issueCode));

  // Hybrid flow (code id_token token)
  server.grant(
    oauth2orizeOpenId.grant.codeIdTokenToken(
      issueToken,
      issueCode,
      issueIdToken
    )
  );
}

export default oidc;
