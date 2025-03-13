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

import type { Class, Constructor } from "type-fest";

/**
 * Class decorator for automagically destructuring the constructor argument
 *
 * @experimental
 */
export function destructure<T, R extends [...unknown[]]>(
  // eslint-disable-next-line @typescript-eslint/naming-convention
  Klass: Constructor<T, [Partial<T>, ...R] | [Partial<T> | undefined]>,
  _context?: unknown,
): Class<T, [Partial<T>]> {
  const properties = Object.getOwnPropertyNames(
    new Klass({}),
  ) as unknown as Array<keyof T>;
  // biome-ignore format: type bs
  return class
    extends // @ts-expect-error classes as variables nonsense
    Klass
  {
    constructor(argument: Partial<T> = {}) {
      const a = [];
      for (const property of properties) {
        a.push(argument[property]);
      }

      super(argument, ...a);
    }
  } as unknown as Class<T, [Partial<T>]>;
}
