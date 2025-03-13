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

import type { LiteralUnion } from "type-fest";

/**
 * This specification defines a set of standard Claims
 *
 * They can be requested to be returned either
 * in the {@link https://openid.net/specs/openid-connect-core-1_0.html#UserInfoResponse UserInfo Response},
 * or in the {@link https://openid.net/specs/openid-connect-core-1_0.html#IDToken ID Token}
 *
 * @todo should probably get this from oada types
 *
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#StandardClaims OIDC Standard Claims}
 */
export interface StandardClaims {
  /**
   * Subject - Identifier for the End-User at the Issuer
   */
  sub: string;
  /**
   * End-User's full name in displayable form including all name parts,
   * possibly including titles and suffixes,
   * ordered according to the End-User's locale and preferences
   */
  name?: string;
  /**
   * Given name(s) or first name(s) of the End-User
   *
   * Note that in some cultures, people can have multiple given names;
   * all can be present, with the names being separated by space characters
   */
  given_name?: string;
  /**
   * Surname(s) or last name(s) of the End-User
   *
   * Note that in some cultures, people can have multiple family names or no family name;
   * all can be present, with the names being separated by space characters
   */
  family_name?: string;
  /**
   * Surname(s) or last name(s) of the End-User
   *
   * Note that in some cultures, people can have multiple family names or no family name;
   * all can be present, with the names being separated by space characters
   */
  middle_name?: string;
  /**
   * Casual name of the End-User that may or may not be the same as the given_name
   *
   * For instance, a nickname value of Mike might be returned alongside a given_name value of Michael
   */
  nickname?: string;
  /**
   * Shorthand name by which the End-User wishes to be referred to at the RP, such as janedoe or j.doe
   *
   * This value MAY be any valid JSON string including special characters such as @, /, or whitespace
   *
   * The RP **MUST NOT** rely upon this value being unique, as discussed in
   * {@link https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability Section 5.7}
   */
  preferred_username?: string;
  /**
   * URL of the End-User's profile page
   *
   * The contents of this Web page **SHOULD** be about the End-User
   */
  profile?: string;
  /**
   * URL of the End-User's profile picture
   *
   * This URL **MUST** refer to an image file
   * (for example, a PNG, JPEG, or GIF image file),
   * rather than to a Web page containing an image
   *
   * Note that this URL **SHOULD** specifically reference a profile photo of the End-User suitable for displaying when describing the End-User,
   * rather than an arbitrary photo taken by the End-User
   */
  picture?: string;
  /**
   * URL of the End-User's Web page or blog
   *
   * This Web page **SHOULD** contain information published by the End-User or an organization that the End-User is affiliated with
   */
  website?: string;
  /**
   * End-User's preferred e-mail address
   *
   * Its value **MUST** conform to the
   * {@link https://www.rfc-editor.org/rfc/inline-errata/rfc5322.html RFC 5322} addr-spec syntax
   *
   * The RP **MUST NOT** rely upon this value being unique, as discussed in
   * {@link https://openid.net/specs/openid-connect-core-1_0.html#ClaimStability Section 5.7}
   */
  email?: string;
  /**
   * `true` if the End-User's e-mail address has been verified; otherwise `false`
   *
   * When this Claim Value is true, this means that the OP took affirmative steps
   * to ensure that this e-mail address was controlled by the End-User at the time the verification was performed
   *
   * The means by which an e-mail address is verified is context specific,
   * and dependent upon the trust framework or contractual agreements within which the parties are operating
   *
   * @see {@link email}
   */
  email_verified?: boolean;
  /**
   * End-User's gender
   *
   * Values defined by this specification are `"female"` and `"male"`
   *
   * Other values **MAY** be used when neither of the defined values are applicable
   */
  gender?: LiteralUnion<"male" | "female", string>;
  /**
   * End-User's birthday,
   * represented as an {@link https://www.iso.org/standard/81801.html ISO 8601-1} YYYY-MM-DD format
   *
   * The year MAY be `"0000"`, indicating that it is omitted
   *
   * To represent only the year, YYYY format is allowed
   *
   * Note that depending on the underlying platform's date related function,
   * providing just year can result in varying month and day,
   * so the implementers need to take this factor into account to correctly process the dates
   */
  birthdate?: string | Date;
  /**
   * String from {@link https://www.iana.org/time-zones IANA Time Zone Database} representing the End-User's time zone
   *
   * @example "Europe/Paris"
   * @example "America/Los_Angeles"
   */
  zoneinfo?: string;
  /**
   * End-User's locale, represented as a {@link https://www.rfc-editor.org/rfc/rfc5646.html BCP47} language tag
   *
   * This is typically an {@link https://www.iso.org/standard/74575.html ISO 639 Alpha-2} language code in lowercase
   * and an {@link https://www.iso.org/standard/72482.html ISO 3166-1 Alpha-2} country code in uppercase,
   * separated by a dash
   *
   * As a compatibility note, some implementations have used an underscore as the separator rather than a dash,
   * for example, `"en_US"`;
   * Relying Parties **MAY** choose to accept this locale syntax as well
   *
   * @example "en-US"
   * @example "fr-CA"
   */
  locale?: string;
  /**
   * End-User's preferred telephone number
   *
   * {@link https://www.itu.int/rec/T-REC-E.164-201011-I/en E.164} is **RECOMMENDED** as the format of this Claim
   *
   * If the phone number contains an extension, it is **RECOMMENDED** that the extension be represented using the
   * {@link https://www.rfc-editor.org/rfc/inline-errata/rfc3966.html RFC 3966} extension syntax
   *
   * @example "+1 (425) 555-1212"
   * @example "+56 (2) 687 2400"
   *
   * @example "+1 (604) 555-1234;ext=5678"
   */
  phone_number?: string;
  /**
   * `true` if the End-User's phone number has been verified; otherwise `false`
   *
   * When this Claim Value is `true`, this means that the OP took affirmative steps to ensure that
   * this phone number was controlled by the End-User at the time the verification was performed
   *
   * The means by which a phone number is verified is context specific,
   * and dependent upon the trust framework or contractual agreements within which the parties are operating
   *
   * When true, the {@link phone_number} Claim **MUST** be in {@link https://www.itu.int/rec/T-REC-E.164-201011-I/en E.164} format
   * and any extensions **MUST** be represented in {@link https://www.rfc-editor.org/rfc/inline-errata/rfc3966.html RFC 3966} format
   *
   * @see {@link phone_number}
   */
  phone_number_verified?: boolean;
  /**
   * End-User's preferred postal address
   */
  address?: AddressClaim;
  /**
   * Time the End-User's information was last updated
   *
   * Its value is a JSON number representing the number of seconds from 1970-01-01T00:00:00Z
   * as measured in UTC until the date/time
   */
  updated_at?: number | Date;
}

/**
 * This is from the official JWT claim registry
 *
 * They can be requested to be returned either
 * in the {@link https://openid.net/specs/openid-connect-core-1_0.html#UserInfoResponse UserInfo Response},
 * or in the {@link https://openid.net/specs/openid-connect-core-1_0.html#IDToken ID Token}
 *
 * @todo some claims still need to be added
 * @todo should probably get this from oada types
 *
 * @see {@link https://www.iana.org/assignments/jwt/jwt.xhtml#claims JWT Registered Claims}
 */
export interface RegisteredClaims extends StandardClaims {
  /**
   * Scope Values
   *
   * String containing a space-separate list of scopes
   *
   * @see {@link https://www.rfc-editor.org/rfc/rfc8693.html#name-scope-scopes-claim RFC 8693 Scopes Claim}
   */
  scope?: string;
  /**
   * Client Identifier
   *
   * @see {@link https://www.rfc-editor.org/rfc/rfc8693.html#name-client_id-client-identifier RFC 8693 Client Identifier Claim}
   */
  client_id?: string;
  /**
   * Roles
   *
   * @see {@link https://www.iana.org/go/rfc7643#section-4.1 RFC 7643 User Resource Schema}
   * @see {@link https://www.rfc-editor.org/rfc/rfc9068.html#name-claims-for-authorization-ou RFC 9068 Section 2.2.3.1}
   */
  roles?: readonly string[];
  /**
   * Groups
   *
   * @see {@link https://www.iana.org/go/rfc7643#section-4.1 RFC 7643 User Resource Schema}
   * @see {@link https://www.rfc-editor.org/rfc/rfc9068.html#name-claims-for-authorization-ou RFC 9068 Section 2.2.3.1}
   */
  groups?: readonly string[];
  /**
   * Entitlements
   *
   * @see {@link https://www.iana.org/go/rfc7643#section-4.1 RFC 7643 User Resource Schema}
   * @see {@link https://www.rfc-editor.org/rfc/rfc9068.html#name-claims-for-authorization-ou RFC 9068 Section 2.2.3.1}
   */
  entitlements?: readonly string[];
}

/**
 * The Address Claim represents a physical mailing address
 *
 * Implementations **MAY** return only a subset of the fields of an address,
 * depending upon the information available and the End-User's privacy preferences
 *
 * For example, the country and region might be returned without returning more fine-grained address information
 *
 * Implementations **MAY** return just the full address as a single string in the {@link formatted} sub-field,
 * or they **MAY** return just the individual component fields using the other sub-fields,
 * or they **MAY** return both
 *
 * If both variants are returned, they **SHOULD** represent the same address,
 * with the formatted address indicating how the component fields are combined
 *
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#AddressClaim OIDC Address Claim}
 */
export interface AddressClaim {
  /**
   * Full mailing address, formatted for display or use on a mailing label
   *
   * This field **MAY** contain multiple lines, separated by newlines
   *
   * Newlines can be represented either as a carriage return/line feed pair (`"\r\n"`)
   * or as a single line feed character (`"\n"`)
   */
  formatted?: string;
  /**
   * Full street address component, which **MAY** include house number, street name, Post Office Box,
   * and multi-line extended street address information
   *
   * This field **MAY** contain multiple lines, separated by newlines
   *
   * Newlines can be represented either as a carriage return/line feed pair (`"\r\n"`)
   * or as a single line feed character (`"\n"`)
   */
  street_address?: string;
  /**
   * City or locality component
   */
  locality?: string;
  /**
   * State, province, prefecture, or region component
   */
  region?: string;
  /**
   * Zip code or postal code component
   */
  postal_code?: string;
  /**
   * Country name component
   */
  country?: string;
}

/**
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#Claims Claims}
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#AdditionalClaims Additional Claims}
 */

export type Claims = Record<string, unknown> & RegisteredClaims;

/**
 * End-User's default profile Claims
 *
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims Scope Claims}
 */
export type ProfileClaims = Record<string, unknown> &
  Pick<
    Claims,
    | "name"
    | "family_name"
    | "given_name"
    | "middle_name"
    | "nickname"
    | "preferred_username"
    | "profile"
    | "picture"
    | "website"
    | "gender"
    | "birthdate"
    | "zoneinfo"
    | "locale"
    | "updated_at"
  >;

/**
 * End-User's `email` and `email_verified` Claims
 *
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims Scope Claims}
 *
 * @see {@link StandardClaims.email}
 * @see {@link StandardClaims.email_verified}
 */
export type EmailClaims = Record<string, unknown> &
  Pick<Claims, "email" | "email_verified">;

/**
 * End-User's `address` Claim
 *
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims Scope Claims}
 *
 * @see {@link StandardClaims.address}
 */
export type AddressClaims = Record<string, unknown> & Pick<Claims, "address">;

/**
 * End-User's `phone_number` and `phone_number_verified` Claims
 *
 * @see {@link https://openid.net/specs/openid-connect-core-1_0.html#ScopeClaims Scope Claims}
 *
 * @see {@link StandardClaims.phone_number}
 * @see {@link StandardClaims.phone_number_verified}
 */
export type PhoneClaims = Record<string, unknown> &
  Pick<Claims, "phone_number" | "phone_number_verified">;
