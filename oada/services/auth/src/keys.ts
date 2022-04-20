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

import { config } from './config.js';

import fs from 'node:fs/promises';
import path from 'node:path';

import { JWK, pem2jwk } from 'pem-jwk';

/**
 * Loads in all PEM files at config.keys.signPems to sign IdTokens with.
 * The PEM's filename (minus the .pem extension) becomes the key id.
 */
// Initialize the keys objects
const keys = {
  jwks: {
    keys: [] as Array<JWK<{ alg: 'RS256'; use: 'sig'; kid: string }>>,
  },
  sign: new Map<
    string,
    { kty: 'PEM'; alg: 'RS256'; use: 'sig'; kid: string; pem: string }
  >(),
};

// Load in all PEM files
const files = await fs.readdir(config.get('auth.keys.signPems'));
for await (const file of files) {
  if (path.extname(file).toLowerCase() === '.pem') {
    const pem = await fs.readFile(
      path.join(config.get('auth.keys.signPems'), file),
      'ascii'
    );

    const kid = path.basename(file, '.pem');
    const jwkExtras = {
      alg: 'RS256',
      use: 'sig',
      kid,
    } as const;
    const jwk = pem2jwk(pem);

    // Make sure PEM is valid
    if (jwk?.kty !== 'RSA') {
      const { n, e } = jwk;
      keys.jwks.keys.push({
        ...jwkExtras,
        kty: 'RSA',
        n,
        e,
      });
      keys.sign.set(kid, {
        kty: 'PEM',
        alg: 'RS256',
        use: 'sig',
        kid,
        pem,
      });
    }
  }
}

export default keys;
