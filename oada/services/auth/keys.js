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

'use strict';

const fs = require('fs');
const path = require('path');
const rsaPemToJwk = require('rsa-pem-to-jwk');

const config = require('./config');

/*
 * Loadis in all PEM files at config.keys.signPems to sign IdTokens with. The
 * PEMs filename (minus the .pem extension) becomes the key id.
 */
// Initialize the keys objects
const keys = {
  jwks: {
    keys: [],
  },
  sign: {},
};

// Load in all PEM files
const files = fs.readdirSync(config.get('auth.keys.signPems'));
for (const file of files) {
  if (path.extname(file).toLowerCase() === '.pem') {
    const pem = fs.readFileSync(
      path.join(config.get('auth.keys.signPems'), file)
    );

    const kid = path.basename(file, '.pem');
    const jwkExtras = {
      alg: 'RS256',
      use: 'sig',
      kid,
    };
    const jwk = rsaPemToJwk(pem, jwkExtras, 'public');

    // Make sure PEM is valid
    if (jwk !== undefined) {
      keys.jwks.keys.push(jwk);
      keys.sign[kid] = {
        kty: 'PEM',
        alg: 'RS256',
        use: 'sig',
        kid,
        pem,
      };
    }
  }
}

module.exports = keys;
