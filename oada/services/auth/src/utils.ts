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

import { promisify } from "node:util";

import type { MiddlewareErrorFunction, MiddlewareFunction } from "oauth2orize";

export function isArray(
  value: unknown,
): value is unknown[] | readonly unknown[] {
  return Array.isArray(value);
}

type Arguments<M extends MiddlewareFunction | MiddlewareErrorFunction> =
  Parameters<M> extends [...rest: infer R, next: unknown] ? R : [];
export function promisifyMiddleware<
  M extends MiddlewareFunction | MiddlewareErrorFunction,
>(middleware: M | readonly M[]): (...rest: Arguments<M>) => Promise<void> {
  if (isArray(middleware)) {
    const middlewares = middleware.map((m) => promisifyMiddleware(m));
    return async (...rest: Arguments<M>) => {
      for await (const m of middlewares) {
        await m(...rest);
      }
    };
  }

  return promisify(middleware) as (...rest: Arguments<M>) => Promise<void>;
}

export function createUserinfo(
  user: Record<string, unknown>,
  scopes: string | readonly string[],
) {
  const userinfo: Record<string, unknown> = {};

  if (scopes.includes("profile")) {
    Object.assign(userinfo, {
      sub: user.id,
      name: user.name,
      family_name: user.family_name,
      given_name: user.given_name,
      middle_name: user.middle_name,
      nickname: user.nickname,
      preferred_username: user.username,
      profile: user.profile,
      picture: user.picture,
      website: user.website,
      gender: user.gender,
      birthdate: user.birthdate,
      zoneinfo: user.zoneinfo,
      locale: user.locale,
      updated_at: user.updated_at,
    });
  }

  if (scopes.includes("email")) {
    Object.assign(userinfo, {
      sub: user.id,
      email: user.email,
      email_verified: user.email_verified,
    });
  }

  if (scopes.includes("address")) {
    Object.assign(userinfo, {
      sub: user.id,
      address: user.address,
    });
  }

  if (scopes.includes("phone")) {
    Object.assign(userinfo, {
      sub: user.id,
      phone_number: user.phone_number,
      phone_number_verified: user.phone_number_verified,
    });
  }

  if (userinfo.sub === undefined) {
    return;
  }

  return userinfo;
}
