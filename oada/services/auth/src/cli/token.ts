/**
 * @license
 * Copyright 2017-2022 Open Ag Data Alliance
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

/* eslint-disable no-console -- This is a CLI */

import '@oada/pino-debug';

import {
  type Type,
  array,
  binary,
  boolean,
  command,
  flag,
  multioption,
  number,
  option,
  optional,
  positional,
  run,
  string,
  subcommands,
  union,
} from 'cmd-ts';
import { Url } from 'cmd-ts/batteries/url';
import chalk from 'chalk';

import { config } from '../config.js';

import type User from '@oada/models/user';

import esMain from 'es-main';

async function getClient(iss: string) {
  const { Issuer, errors } = await import('openid-client');
  try {
    const issuer = await Issuer.discover(iss);
    const issuerUrl = new URL(issuer.metadata.issuer);
    const { metadata } = await issuer.Client.register({
      client_name: 'OADA Auth CLI',
      application_type: 'native',
      redirect_uris: ['https://localhost:3000/redirect'],
      grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
      ...// TODO: Figure out better place for issuer specific quirks?
      (issuerUrl.hostname.endsWith('auth0.com')
        ? { token_endpoint_auth_method: 'none' }
        : {}),
    });
    return new issuer.Client(metadata);
  } catch (error: unknown) {
    if (error instanceof errors.OPError) {
      // @ts-expect-error stuff
      error.message ??= `${error.response.body.message}`;
    }

    throw error;
  }
}

const iss = option({
  description: 'OIDC Issuer URL',
  long: 'issuer',
  type: config.get('oidc.issuer') ? optional(Url) : Url,
});
const scope = multioption({
  description: 'Scope(s) to request for the token',
  long: 'scope',
  short: 's',
  type: optional(array(string)),
});

export const get = command({
  name: 'get',
  description: 'Request a token using OAuth2.0/OIDC',
  args: {
    iss,
    scope,
    qr: flag({
      description: 'Output QR code for user verification',
      long: 'qrcode',
      short: 'q',
      type: optional(boolean),
    }),
  },
  // eslint-disable-next-line @typescript-eslint/no-shadow
  async handler({ scope = [], iss, qr }) {
    const client = await getClient(
      iss ? `${iss}` : `${config.get('oidc.issuer')}`,
    );

    const handle = await client.deviceAuthorization({
      scope: scope.join(' '),
    });

    console.group('User verification:');
    console.error(chalk.reset(`User Code: ${chalk.green(handle.user_code)}`));
    console.error(
      chalk.reset(`Verification URI: ${chalk.blue(handle.verification_uri)}`),
    );
    console.error(
      chalk.reset(
        `Verification URI (complete): ${chalk.blue(handle.verification_uri_complete.replace(handle.user_code, chalk.green(handle.user_code)))}`,
      ),
    );
    if (qr !== false) {
      const { default: qrcode } = await import('qrcode-terminal');
      qrcode.generate(
        handle.verification_uri_complete,
        { small: true },
        (code) => console.error(chalk.bgBlack.white(code)),
      );
    }

    console.groupEnd();

    const token = await handle.poll();
    console.log('%j', token);
  },
});

// eslint-disable-next-line @typescript-eslint/naming-convention
const UserType: Type<string, User> = {
  async from(id) {
    const { User } = await import('@oada/models/user');
    const { findById, findByUsername } = await import('../db/models/user.js');

    const user = (await findById(id)) ?? (await findByUsername(id));
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    return new User(user);
  },
};

/**
 * @todo support other token storage??
 */
export const create = command({
  name: 'create',
  aliases: ['issue', 'new'],
  description: 'Create a token (only works when using local auth in arango)',
  args: {
    iss,
    scope,
    user: option({
      type: UserType,
      description: 'User ID or username',
      long: 'user',
      short: 'u',
    }),
    iat: option({
      type: optional(union([number, string])),
      description: 'Creation time',
      long: 'iat',
      short: 't',
    }),
    exp: option({
      type: optional(union([number, string])),
      description: 'Expiration time',
      long: 'exp',
      short: 'e',
    }),
    jti: positional({
      type: optional(string),
      displayName: 'token id',
      description: 'Token to create',
    }),
  },
  // eslint-disable-next-line @typescript-eslint/no-shadow
  async handler({ iss, scope, user: { sub }, iat, exp, jti }) {
    const { Authorization } = await import('@oada/models/authorization');
    const { create: createToken } = await import('../db/arango/tokens.js');

    const auth = new Authorization({
      iss: iss ? `${iss}` : `${config.get('oidc.issuer')}`,
      sub,
      iat: iat as number,
      exp: exp as number,
      scope: scope?.join(' '),
      jti,
    });
    const token = await createToken(auth);

    if (!jti) {
      console.log(token);
    }
  },
});

/**
 * @todo implement this
 */
export const revoke = command({
  name: 'revoke',
  aliases: ['disable'],
  description: 'Revoke a token',
  args: {
    iss,
    token: positional({
      displayName: 'token',
      type: string,
      description: 'Token to revoke',
    }),
  },
  handler() {
    throw new Error('Not yet implemented');
  },
});

export const cmd = subcommands({
  name: 'token',
  cmds: {
    get,
    create,
    revoke,
  },
});

if (esMain(import.meta)) {
  await run(binary(cmd), process.argv);
}
