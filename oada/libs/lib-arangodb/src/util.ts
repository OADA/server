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

import type { Except } from "type-fest";

export type Selector<T> = T extends { _id?: infer I } ? I | { _id: I } : never;

/**
 * @todo clean up this mess
 */
export function sanitizeResult<T>(
  result: T,
): Except<
  T & { _rev?: number; _key?: unknown; _oada_rev?: unknown },
  "_key" | "_oada_rev"
> {
  if (!(result && typeof result === "object")) {
    // @ts-expect-error nonsense
    return result;
  }

  const { _key, _oada_rev, _rev, ...rest } = result as {
    _key?: string;
    _oada_rev?: number;
    _rev?: number;
  };

  const rev = _oada_rev ?? _rev;
  return (rev ? { _rev: rev, ...rest } : rest) as unknown as Except<
    T & { _rev?: number; _key?: unknown; _oada_rev?: unknown },
    "_key" | "_oada_rev"
  >;
}
