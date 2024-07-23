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

import { config } from './config.js';

import {
  createPrivateKey,
  createPublicKey,
  createSecretKey,
} from 'node:crypto';

import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  generateSecret,
} from 'jose';

const tokenConfig = config.get('auth.token');

/**
 * @todo proper key/kid management/storage/rotation
 */
export const kid = 'oauth2-1';

export async function getKeyPair(file: File | string | undefined, alg: string) {
  if (!file) {
    return generateKeyPair(alg);
  }

  // Assume file is a private key
  const privateKey = createPrivateKey(
    typeof file === 'string' ? file : Buffer.from(await file.arrayBuffer()),
  );
  // Derive a public key from the private key
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey };
}

export async function getSymmetricKey(
  file: File | string | undefined,
  alg: string,
) {
  if (!file) {
    return generateSecret(alg);
  }

  const key =
    typeof file === 'string' ? file : Buffer.from(await file.arrayBuffer());
  return createSecretKey(key as NodeJS.ArrayBufferView);
}

/**
 * @internal
 * @todo Support key rotation and stuff
 */
export const { publicKey, privateKey } = await getKeyPair(
  await tokenConfig.key,
  tokenConfig.alg,
);
export const jwksPublic = {
  keys: [
    {
      kid,
      alg: tokenConfig.alg,
      use: 'sig',
      ...(await exportJWK(publicKey)),
    },
  ],
};

/** @internal */
export const JWKS = createLocalJWKSet(jwksPublic);
