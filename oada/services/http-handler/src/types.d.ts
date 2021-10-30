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

declare module 'oada-error' {
  export class OADAError {
    constructor(
      message: string,
      code?: number,
      userMessage?: string | null,
      href?: string | null,
      detail?: string | null
    );
  }
}

declare module 'es-main' {
  function esMain(meta: any): boolean;
  export = esMain;
}

// Make TS understand assert better
declare module 'assert' {
  function internal(value: any, message?: string | Error): asserts value;
}
