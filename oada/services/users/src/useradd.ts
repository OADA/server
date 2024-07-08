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

/* eslint-disable unicorn/no-process-exit, n/no-process-exit -- This is a cli command */

import '@oada/pino-debug';
import { config } from './config.js';

import { Requester } from '@oada/lib-kafka';
import User from '@oada/models/user';
import { users } from '@oada/lib-arangodb';

import chalk from 'chalk';
import debug from 'debug';
import minimist from 'minimist';
import promptly from 'promptly';

import type { UserRequest, UserResponse } from './server.js';

const argv = minimist(process.argv.slice(2));

const info = debug('useradd:info');
const error = debug('useradd:error');
const trace = debug('useradd:trace');

async function findUserByUsername(username: string) {
  const like = await users.like({ username });

  // eslint-disable-next-line no-unreachable-loop
  for await (const user of like) {
    trace({ user }, 'findUserByUsername: Finished users.like');
    return user;
  }
}

// The main event:
try {
  if (argv.h || argv.help) {
    error(
      chalk.yellow`useradd [-u username] [-d domain] [-p password] [-a (if you want user to have admin privileges to create other users)]`,
    );
    process.exit();
  }

  // -------------------------------------
  // Talk to user service over Kafka...
  trace('Creating kafka requester...');
  // Produce a request to the user service to create one for us:
  const kafkareq = new Requester({
    // Topic to look for final answer on (consume):
    consumeTopic: config.get('kafka.topics.httpResponse'),
    // Topic to send request on (produce):
    produceTopic: config.get('kafka.topics.userRequest'),
    // Group name
    group: 'useradd',
  });

  // -----------------------------------------------------
  // Ensure we have a username and password...
  const username = (argv.u ||
    argv.username ||
    (await promptly.prompt('Username: '))) as string;
  if (await findUserByUsername(username)) {
    error(chalk.red`Username ${username} already exists`);
    process.exit(1);
  }

  const p = (argv.password ?? argv.p) as string | boolean | undefined;
  const password = p
    ? p === true
      ? await promptly.prompt('Password: ')
      : p
    : undefined;
  const isAdmin = Boolean(argv.a || argv.isadmin || argv.isAdmin);
  const domain = `${argv.domain || argv.d || process.env.DOMAIN || 'localhost'}`;
  trace('Sending request to kafka');
  const user = {
    username,
    domain,
    password,
    // Add scope if you want the user to have permission to create other users
    roles: isAdmin ? ['oada.admin.user:all'] : [],
  } satisfies Partial<User>;
  const response = (await kafkareq.send({
    // @ts-expect-error secret prop
    connection_id: 'useradd',
    token: 'admin',
    authorization: {
      scope: ['oada.admin.user:all'],
    },
    // The "user" key is what goes into the DB
    user,
  } satisfies UserRequest)) as unknown as UserResponse;

  trace({ response }, 'Finished kafka.send');
  // No need to keep hearing messages
  trace('Disconnecting from kafka');
  await kafkareq.disconnect();

  trace({ response }, 'Checking response.code');
  if (response.code !== 'success') {
    error(
      chalk.red`FAILED TO RECEIVE SUCCESSFUL RESPONSE FROM USER SERVICE WHEN CREATING USER!`,
    );
    process.exit(1);
  }

  // Now we have a user
  const su = response.user;
  info(chalk.green`User {cyan ${su!._id}} now exists`);
} catch (cError: unknown) {
  error({ error: cError });
  process.exit(1);
}
