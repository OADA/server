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

import { config } from '../../config.js';

import path from 'node:path';
import url from 'node:url';

import debug from 'debug';

import { Codes, OADAError } from '@oada/error';

const log = debug('model-tokens');

export interface ITokens {
  findByToken(token: string): Promise<IToken>;
  save(token: Token): Promise<void>;
}

const dirname = path.dirname(url.fileURLToPath(import.meta.url));
const { datastoresDriver } = config.get('auth');
const database = (await import(
  path.join(dirname, '..', datastoresDriver, 'tokens.js')
)) as ITokens;

export interface IToken {
  readonly id?: string;
  readonly token: string;
  readonly scope?: readonly string[];
  readonly user: { readonly id: string };
  readonly clientId: string;
  readonly createTime?: number;
  readonly expiresIn?: number;
}
export class Token implements IToken {
  readonly id;
  readonly token;
  readonly scope;
  readonly user;
  readonly clientId;
  readonly createTime;
  readonly expiresIn;

  constructor({
    id,
    token,
    scope = [],
    user,
    clientId,
    createTime = Date.now(),
    expiresIn = 60,
  }: IToken) {
    this.id = id;
    this.token = token!;
    this.clientId = clientId!;
    this.scope = scope;
    this.user = user;
    this.createTime = createTime;
    this.expiresIn = expiresIn;

    if (!this.isValid()) {
      throw new Error('Invalid token');
    }
  }

  isValid() {
    return (
      typeof this.token === 'string' &&
      Array.isArray(this.scope) &&
      typeof this.user === 'object' &&
      typeof this.clientId === 'string' &&
      typeof this.expiresIn === 'number'
    );
  }

  isExpired() {
    return this.createTime + this.expiresIn < Date.now();
  }
}

export async function findByToken(token: string) {
  const t = await database.findByToken(token);
  if (t) {
    return new Token(t);
  }
}

export async function save(t: IToken) {
  const token = t instanceof Token ? t : new Token(t);

  const tok = await findByToken(token.token);
  if (tok) {
    throw new OADAError(
      'Token already exists',
      Codes.BadRequest,
      'There was a problem login in'
    );
  }

  log(token, 'save: saving token ');
  await database.save(token);

  const saved = await findByToken(token.token);
  if (!saved) {
    throw new Error('Could not save token');
  }

  return saved;
}
