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

/* eslint-disable no-console, no-process-exit, unicorn/no-process-exit -- This is a cli command */

import '@oada/pino-debug';

import chalk from 'chalk';
import debug from 'debug';
import minimist from 'minimist';
import { v4 } from 'uuid';

import { authorizations, users } from '@oada/lib-arangodb';

const argv = minimist(process.argv.slice(2));

const trace = debug('token:trace');

const [command, token] = argv._;

const usage = () => {
  console.error(
    // eslint-disable-next-line sonarjs/no-nested-template-literals
    `${chalk.yellow`USAGE: node token.js <extend | create | disable> [-e <new expiresIn>] [-c <new createTime> | -n] [-u <userid | username>] [-s <scope_str>] [token]`}
extend:
\t-e expiresIn: milliseconds (defaults to 0 (never))
\t-n: set createTime to now
\t-c <time>: set createTime to <time>
\t<token>: last arg must be the token you want to extend
create:
\t-u <userid | username>: create token for user if it has a slash, it is assumed to be a userid (like users/12345). Otherwise, it is assumed to be a username.
\t-s <scope_string>: comma-separated list of scopes, defaults to all:all
\t-i <client_id>: id of OAuth client for token, defaults to system/token
disable:
\t<token>: disable <token> by making it expired`,
  );
};

/* Example authorization:
 {
      _id: 'authorizations/default:authorization-012',
      token: 'mike',
      scope: ['oada.fields:all', 'oada.operations:all'],
      createTime: 1413831649937,
      expiresIn: 0,
      user: { _id: 'users/default:users_servio_012' },
      clientId: 'jf93caauf3uzud7f308faesf3@provider.oada-dev.com',
    },
*/

// The main event:
// ./extendTime -n abc ==> should not have argv.n = 'abc'
if (typeof argv.n === 'string') {
  trace('have -n, fixing argv.');
  argv._ = [...argv._, argv.n];
  argv.n = true;
}

if (argv.h || argv.help || !argv._[0]) {
  trace('Help:');
  usage();

  process.exit();
}

const getNow = () => Date.now() / 1000;

async function extend() {
  trace('Running extend');
  const expiresIn = argv.e ? Number(argv.e) : 0;
  const createTime = argv.n ? getNow() : (argv.c as number) || undefined;

  const auth = await authorizations.findByToken(token!);
  if (!auth) {
    throw new Error('Unable to find auth matching token');
  }

  trace({ auth }, 'Found auth');
  return {
    ...auth,
    expiresIn,
    ...(createTime ? { createTime } : {}),
    // Library filled this in, replace with just _id
    user: { _id: auth.user._id },
  };
}

async function create() {
  trace('Running create');
  if (!argv.u) {
    console.error('You must provide a userid (users/123) or a username (bob)');
    usage();
    return;
  }

  let userid = argv.u as string;
  // If there is not a slash in the -u argument's value, assume we need to lookup userid for this username
  if (!userid.includes('/')) {
    const u = await users.findByUsername(userid);
    userid = u!._id;
    if (!userid) {
      console.error('Unable to find username %s. Aborting.', argv.u);
      return;
    }

    console.log('Looked up username %s and found userid %s', argv.u, userid);
  }

  const scope = argv.s ? `${argv.s}`.split(',') : ['all:all'];
  const createTime = argv.c ? Number(argv.c) : getNow();
  const expiresIn = argv.e ? Number(argv.e) : 0; // Default does not expire
  const clientId = argv.i ? String(argv.i) : 'system/token';
  const tok = token ?? v4().replaceAll('-', '');
  return {
    token: tok,
    scope,
    createTime,
    expiresIn,
    user: { _id: userid },
    clientId,
  };
}

async function disable() {
  const auth = await authorizations.findByToken(token!);
  trace({ auth }, 'Found auth');

  return { ...auth, createTime: getNow(), expiresIn: 1 };
}

let update;
trace('argv._[0] = %s', argv._[0]);
switch (command) {
  case 'extend': {
    update = await extend();
    break;
  }

  case 'create': {
    update = await create();
    break;
  }

  case 'disable': {
    update = await disable();
    break;
  }

  default: {
    usage();
    process.exit();
  }
}

if (update) {
  trace({ update }, 'Sending updated token');
  // @ts-expect-error stuff
  await authorizations.save(update);
  console.log({ ...update }, chalk.green`Successfully wrote token`);
}
