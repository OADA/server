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
  import {
    NextFunction,
    NextFunction,
    Request,
    Request,
    Response,
    Response,
  } from 'express';

  export class OADAError extends Error {
    constructor(mesg: string, code?: codes);
  }
  export const enum codes {
    NOT_FOUND = 404,
  }
  export function middleware(
    callback: (...arguments_: unknown[]) => void
  ): (error: Error, request: Request, res: Response, nex: NextFunction) => void;
}

declare module '@oada/well-known-json' {
  const wellKnown: (options: { forceProtocol?: string }) => {
    (request: Request, res: Response, next: NextFunction): void;
    addResource(uri: string, object: Record<string, unknown>): void;
  };

  export = wellKnown;
}
