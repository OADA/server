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
  export default function esMain(meta: unknown): boolean;
}

declare module 'nstats' {
  import type { Server as HTTPServer } from 'node:http';

  import type { Plugin } from 'fastify-plugin';
  import type { Server as WSServer } from 'ws';

  export interface NStats {
    fastify(): Plugin;
    toPrometheus(): string;
  }

  function nstats(ws?: WSServer, http?: HTTPServer, semver?: string): NStats;

  export = nstats;
}

declare global {
  declare module 'fastify' {
    import type { Authenticate } from 'fastify-jwt-jwks';
    // eslint-disable-next-line node/no-extraneous-import
    import type { TokenClaims } from '@oada/http-handler';
    import type { User } from '@oada/models/user';

    interface FastifyInstance {
      authenticate: Authenticate;
    }

    interface FastifyRequest {
      user?: User & TokenClaims;
    }
  }
}
