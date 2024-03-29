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

/* eslint-disable no-console -- This is a cli command */
/* eslint-disable @typescript-eslint/no-shadow */

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

import { config } from '../config.js';

import { Issuer, errors } from 'openid-client';
import Authorization from '@oada/models/authorization';
import User from '@oada/models/user';
import esMain from 'es-main';
import qrcode from 'qrcode-terminal';

import { findById, findByUsername } from '../db/models/user.js';
import { getToken } from '../oauth2.js';

async function getClient(iss: string) {
  try {
    const issuer = await Issuer.discover(iss);
    const { metadata } = await issuer.Client.register({
      client_name: 'OADA Auth CLI',
      application_type: 'native',
      redirect_uris: [],
      grant_types: ['urn:ietf:params:oauth:grant-type:device_code'],
      token_endpoint_auth_method: 'none',
    });
    return new issuer.Client(metadata);
  } catch (error: unknown) {
    if (error instanceof errors.OPError) {
      // @ts-expect-error stuff
      error.message = `${error.response.body.message}`;
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
  async handler({ scope, iss, qr }) {
    const client = await getClient(
      iss ? `${iss}` : `${config.get('oidc.issuer')}`,
    );

    const handle = await client.deviceAuthorization({
      scope: scope?.join(' '),
    });

    console.error('Verify user:');
    console.group('user-verify');
    console.error('User Code:', handle.user_code);
    console.error('Verification URI:', handle.verification_uri);
    console.error(
      'Verification URI (complete):',
      handle.verification_uri_complete,
    );
    if (qr !== false) {
      qrcode.generate(
        handle.verification_uri_complete,
        { small: true },
        console.error,
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
    const user = (await findById(id)) ?? (await findByUsername(id));
    if (!user) {
      throw new Error(`User ${id} not found`);
    }

    return new User(user);
  },
};

export const create = command({
  name: 'create',
  aliases: ['issue', 'new'],
  description: 'Create a token (only works when using local auth)',
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
  },
  async handler({ iss, scope, user, iat, exp }) {
    const auth = new Authorization({
      user,
      scope: scope?.join(' '),
    });
    const token = await getToken(
      iss ? `${iss}` : `${config.get('oidc.issuer')}`,
      { ...auth },
      { exp: exp ?? auth.expiresIn, iat: iat ?? auth.createTime },
    );
    console.log(token);
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
  async handler() {
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
