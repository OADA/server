/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import '@oada/pino-debug';

import {
  array,
  binary,
  command,
  multioption,
  option,
  optional,
  positional,
  run,
  string,
} from 'cmd-ts';
import { File } from 'cmd-ts/batteries/fs';
import { Url } from 'cmd-ts/batteries/url';

import { writeFile } from 'node:fs/promises';

import { config } from '../config.js';

import type Metadata from '@oada/types/oauth-dyn-reg/metadata.js';

import { Issuer, errors } from 'openid-client';
import esMain from 'es-main';

export const cmd = command({
  name: 'client',
  args: {
    dataFile: positional({
      type: optional(File),
    }),
    outFile: option({
      long: 'out-file',
      short: 'o',
      type: optional(string),
    }),
    iss: option({
      long: 'issuer',
      type: config.get('oidc.issuer') ? optional(Url) : Url,
    }),
    redirects: multioption({
      long: 'redirect',
      short: 'r',
      type: array(string),
      defaultValue() {
        return ['https://localhost:3000/callback'];
      },
    }),
  },
  async handler({ dataFile, redirects, iss, outFile }) {
    try {
      const issuer = await Issuer.discover(
        iss ? `${iss}` : `${config.get('oidc.issuer')}`,
      );
      const data = (
        dataFile ? await import(dataFile) : {}
      ) as Partial<Metadata>;
      const { metadata } = await issuer.Client.register({
        ...data,
        redirect_uris: [...redirects, ...(data.redirect_uris ?? [])],
        id_token_signed_response_alg: 'HS256',
      });

      const client = new issuer.Client({
        ...metadata,
        // FIXME: Why does Auth0 need this?
        id_token_signed_response_alg: 'HS256',
      });

      const out = { ...issuer.metadata, ...client };
      console.dir(out);

      if (outFile) {
        await writeFile(outFile, JSON.stringify(out, undefined, 2));
      }
    } catch (error: unknown) {
      if (error instanceof errors.OPError) {
        // @ts-expect-error stuff
        error.message = `${error.response.body.message}`;
      }

      throw error;
    }
  },
});

if (esMain(import.meta)) {
  await run(binary(cmd), process.argv);
}
