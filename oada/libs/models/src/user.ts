/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
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

import type { Except, OmitIndexSignature, Opaque } from "type-fest";
import type { Claims } from "./oidc.js";
import { destructure } from "./decorators.js";
import { generate } from "xksuid";
import { makeClass } from "@qlever-llc/interface2class";

export type UserID = Opaque<`users/${string}`, User>;

/**
 * User model for OADA
 *
 * @example
 * ```json
 * {
 *  "_id": "123frank",
 *  "username": "frank",
 *  "password": "test",
 *  "name": "Farmer Frank",
 *  "family_name": "Frank",
 *  "given_name": "Farmer",
 *  "middle_name": "",
 *  "nickname": "Frankie",
 *  "email": "frank@openag.io",
 *  "oidc": [
 *    {
 *      "sub": "foo|bar",
 *      "iss": "https://example.com/",
 *    }
 *  ]
 * }
 * ```
 */
export
@destructure
class User extends makeClass<Except<OmitIndexSignature<Claims>, "sub">>() {
  constructor(user?: Partial<User>);

  constructor(
    user: Partial<User> = {},
    /**
     * Our unique ID for this user
     */
    // @ts-expect-error deprecated field
    public readonly sub: string = user._id ? `${user._id}` : `${generate()}`,
    public domain = "localhost",
    public password?: string,
    /**
     * Record mapping OIDC domains to OIDC claims for this User
     */
    public oidc: readonly Claims[] = [],
    public username = user.name ??
      user.nickname ??
      user.email ??
      usernameFromOIDC(oidc) ??
      sub,
    /**
     * The "scopes" of the User (e.g., "oada.admin.user:all")
     */
    public override roles: readonly string[] = [],
    /**
     * Link to the resource of this User's /bookmarks
     */
    public bookmarks: { _id: string } = { _id: "" },
    /**
     * Link to the resource of this User's /shares
     */
    public shares: { _id: string } = { _id: "" },
  ) {
    super(user);
  }
}

function usernameFromOIDC(oidc: User["oidc"]) {
  for (const { sub, iss, preferred_username, email, nickname } of oidc) {
    const value = preferred_username ?? email ?? nickname ?? `${iss}|${sub}`;
    if (value) {
      return value;
    }
  }
}

export type {
  Claims,
  ProfileClaims,
  EmailClaims,
  PhoneClaims,
  StandardClaims,
} from "./oidc.js";

export default User;
