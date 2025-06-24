/**
 * @license
 * Copyright 2017-2024 Open Ag Data Alliance
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

import type { ITokens, Token } from "../models/token.js";
// @ts-expect-error IDEK
import tokens from "./tokens.json";

const database = new Map(Object.entries(tokens as Record<string, Token>));

export const verify = ((token: string) => {
  const found = structuredClone(database.get(token));
  if (!found) {
    throw new Error("Token not found");
  }

  return found;
}) satisfies ITokens["verify"];

export const create = ((token: Token) => {
  database.set(token.jti, token);
  return token.jti;
}) satisfies ITokens["create"];
