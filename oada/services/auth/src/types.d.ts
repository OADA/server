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

declare module 'connect-arango' {
  import type { Class } from 'type-fest';
  import type { Database } from 'arangojs';
  import session from 'express-session';
  class ArangoStore extends session.Store {}
  export interface Options {
    collection: string;
    db: Database;
  }

  const c: Class<ArangoStore, [Options]>;
  export = c;
}

declare module 'es-main' {
  function esMain(meta: unknown): boolean;
  export = esMain;
}

// Make TS understand assert better
declare module 'assert' {
  function internal(value: unknown, message?: string | Error): asserts value;
}

declare module 'oauth2orize-openid' {
  import type { MiddlewareFunction, OAuth2, OAuth2Req } from 'oauth2orize';
  type IssueCodeCB = (
    client: OAuth2['Client'],
    redirect: string,
    user: OAuth2['User'],
    request: OAuth2Req,
    // eslint-disable-next-line @typescript-eslint/ban-types
    done: (error: null | Error, code?: string) => void
  ) => void;
  type IssueTokenCB = (
    client: OAuth2['Client'],
    user: OAuth2['User'],
    request: OAuth2Req,
    done: (
      // eslint-disable-next-line @typescript-eslint/ban-types
      error: null | Error,
      token?: string,
      parameters?: Record<string, unknown>
    ) => void
  ) => void | Promise<void>;
  type IssueIDTokenCB = (
    client: OAuth2['Client'],
    user: OAuth2['User'],
    request: OAuth2Req,
    // eslint-disable-next-line @typescript-eslint/ban-types
    done: (error: null | Error, idToken?: {}) => void
  ) => void;
  function extensions(): MiddlewareFunction;
  namespace grant {
    /**
     * Handles requests to obtain a response with an authorization code and ID
     * token.
     *
     * References:
     *  - [OpenID Connect Standard 1.0 - draft 21](http://openid.net/specs/openid-connect-standard-1_0.html)
     *  - [OpenID Connect Messages 1.0 - draft 20](http://openid.net/specs/openid-connect-messages-1_0.html)
     *  - [OAuth 2.0 Multiple Response Type Encoding Practices - draft 08](http://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
     *
     * @param {Object} options
     * @param {Function} issue
     * @return {Object} module
     */
    export function codeIdToken(
      issueCode: IssueCodeCB,
      issueIDToken: IssueIDTokenCB
    ): MiddlewareFunction;
    /**
     * Handles requests to obtain a response with an access token, authorization
     * code, and ID token.
     *
     * References:
     *  - [OpenID Connect Standard 1.0 - draft 21](http://openid.net/specs/openid-connect-standard-1_0.html)
     *  - [OpenID Connect Messages 1.0 - draft 20](http://openid.net/specs/openid-connect-messages-1_0.html)
     *  - [OAuth 2.0 Multiple Response Type Encoding Practices - draft 08](http://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
     *
     * @param {Object} options
     * @param {Function} issue
     * @return {Object} module
     */
    export function codeIdTokenToken(
      issueToken: IssueTokenCB,
      issueCode: IssueCodeCB,
      issueIDToken: IssueIDTokenCB
    ): MiddlewareFunction;
    /**
     * Handles requests to obtain a response with an access token and authorization
     * code.
     *
     * References:
     *  - [OpenID Connect Standard 1.0 - draft 21](http://openid.net/specs/openid-connect-standard-1_0.html)
     *  - [OpenID Connect Messages 1.0 - draft 20](http://openid.net/specs/openid-connect-messages-1_0.html)
     *  - [OAuth 2.0 Multiple Response Type Encoding Practices - draft 08](http://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
     *
     * @param {Object} options
     * @param {Function} issue
     * @return {Object} module
     */
    export function codeToken(
      issueToken: IssueTokenCB,
      issueCode: IssueCodeCB
    ): MiddlewareFunction;
    /**
     * Handles requests to obtain a response with an ID token.
     *
     * References:
     *  - [OpenID Connect Standard 1.0 - draft 21](http://openid.net/specs/openid-connect-standard-1_0.html)
     *  - [OpenID Connect Messages 1.0 - draft 20](http://openid.net/specs/openid-connect-messages-1_0.html)
     *  - [OAuth 2.0 Multiple Response Type Encoding Practices - draft 08](http://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
     *
     * @param {Object} options
     * @param {Function} issue
     * @return {Object} module
     */
    export function idToken(issue: IssueIDTokenCB): MiddlewareFunction;
    /**
     * Handles requests to obtain a response with an access token and ID token.
     *
     * References:
     *  - [OpenID Connect Standard 1.0 - draft 21](http://openid.net/specs/openid-connect-standard-1_0.html)
     *  - [OpenID Connect Messages 1.0 - draft 20](http://openid.net/specs/openid-connect-messages-1_0.html)
     *  - [OAuth 2.0 Multiple Response Type Encoding Practices - draft 08](http://openid.net/specs/oauth-v2-multiple-response-types-1_0.html)
     *
     * @param {Object} options
     * @param {Function} issue
     * @return {Object} module
     */
    export function idTokenToken(
      issueToken: IssueTokenCB,
      issueIDToken: IssueIDTokenCB
    ): MiddlewareFunction;
  }
}

declare module 'oauth2orize-pkce' {
  import type { MiddlewareFunction } from 'oauth2orize';
  export function extensions(): MiddlewareFunction;
}
