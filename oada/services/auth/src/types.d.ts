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

declare module 'es-main' {
  function esMain(meta: unknown): boolean;
  export = esMain;
}

declare module 'oauth2orize-openid' {
  import type {
    IssueGrantCodeFunction,
    IssueGrantCodeFunctionArity4,
    IssueGrantCodeFunctionArity6,
    IssueGrantCodeFunctionArity7,
    IssueGrantTokenFunction,
    MiddlewareFunction,
    OAuth2Req,
  } from 'oauth2orize';
  function extensions(): MiddlewareFunction;
  type IssueCode =
    | IssueGrantCodeFunction
    | IssueGrantCodeFunctionArity4
    | IssueGrantCodeFunctionArity6
    | IssueGrantCodeFunctionArity7;
  type IssueToken = IssueGrantTokenFunction;
  type IssueIDToken<C = unknown, U = unknown> = (
    client: C,
    user: U,
    request: OAuth2Req,
    // eslint-disable-next-line @typescript-eslint/ban-types
    done: (error: null | Error, idToken?: {}) => void,
  ) => void;
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
    export function codeIdToken<C, U>(
      issueCode: IssueCode,
      issueIDToken: IssueIDToken<C, U>,
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
    export function codeIdTokenToken<C, U>(
      issueToken: IssueToken,
      issueCode: IssueCode,
      issueIDToken: IssueIDToken<C, U>,
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
      issueToken: IssueToken,
      issueCode: IssueCode,
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
    export function idToken<C, U>(
      issue: IssueIDToken<C, U>,
    ): MiddlewareFunction;
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
    export function idTokenToken<C, U>(
      issueToken: IssueToken,
      issueIDToken: IssueIDToken<C, U>,
    ): MiddlewareFunction;
  }
}

declare module 'oauth2orize-pkce' {
  import type { MiddlewareFunction } from 'oauth2orize';
  export function extensions(): MiddlewareFunction;
  declare module 'oauth2orize' {
    interface OAuth2Req {
      codeChallenge?: string;
      codeChallengeMethod: 'plain' | 'S256';
    }
  }
}

declare module 'passport-oauth2-jwt-bearer' {
  import { Strategy } from 'passport';
  export interface Options {
    /** @default false */
    passReqToCallback?: boolean;
  }
  export type VerifyFunction = (
    clientId: string,
    clientSecret: string,
    done: (
      error: Error | undefined,
      client?: Record<string, unknown>,
      info?: Record<string, unknown>,
    ) => void,
  ) => void;
  class OAuth2JWTBearerStrategy extends Strategy {
    name: 'oauth2-jwt-bearer';

    constructor(options: Options, verify: VerifyFunction);

    constructor(verify: VerifyFunction);
  }
  export { OAuth2JWTBearerStrategy as Strategy };
}

declare module 'random-id-base36' {
  namespace RandomIdBase36 {
    function randId(digits: number, base = 36): string;
  }
  export = RandomIdBase36;
}

declare module 'oauth2orize-device-code' {
  import type { MiddlewareFunction } from 'oauth2orize';

  export class TokenError extends Error {
    constructor(message: string, code: string, uri?: string, status?: string);
  }
  interface Done<R extends [...unknown]> {
    (error?: Error): void;
    (error: undefined, ...rest: R): void;
  }
  export interface Options {
    verificationURI?: string;
    /** @default 'user' */
    userProperty?: string;
    /** @default ' ' */
    scopeSeparator?: string;
  }
  export type IssueDeviceCodeFunctionArity3<Client> = (
    client: Client,
    scope: string | readonly string[],
    done: Done<
      [
        deviceCode: string,
        userCode: string,
        params: {
          [key: string]: unknown;
          expires_in: number;
        },
      ]
    >,
  ) => void;
  export type IssueDeviceCodeFunction<Client> =
    IssueDeviceCodeFunctionArity3<Client>;

  export namespace middleware {
    export function authorization<Client, User>(
      issue: IssueDeviceCodeFunction<Client>,
    ): MiddlewareFunction<Client, User>;
    export function authorization<Client, User>(
      options: Options,
      issue: IssueDeviceCodeFunction<Client>,
    ): MiddlewareFunction<Client, User>;
  }
  export type ActivateDeviceCodeFunction<Client, User> = (
    client: Client,
    deviceCode: string,
    user: User,
    done: Done<never[]>,
  ) => void;
  export namespace grant {
    export function deviceCode<Client, User>(
      activateDeviceCode: ActivateDeviceCodeFunction<Client, User>,
    ): MiddlewareFunction<Client, User>;
  }
  export type ExchangeDeviceCodeFunction<Client> = (
    client: Client,
    deviceCode: string,
    done: Done<[acessToken: string, refreshToken?: string]>,
  ) => void;
  export namespace exchange {
    export function deviceCode<Client, User>(
      issueToken: ExchangeDeviceCodeFunction<Client>,
    ): MiddlewareFunction<Client, User>;
  }
}
