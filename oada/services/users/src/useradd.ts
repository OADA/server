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

import { Requester } from '@oada/lib-kafka';
import { users } from '@oada/lib-arangodb';

import type { User, UserRequest, UserResponse } from './server.js';
import { config } from './config.js';

import chalk from 'chalk';
import debug from 'debug';
import minimist from 'minimist';
import promptly from 'promptly';

const argv = minimist(process.argv.slice(2));

const trace = debug('useradd:trace');

async function findUserByUsername(username: string) {
  const like = await users.like({ username });
  // eslint-disable-next-line no-unreachable-loop
  for await (const user of like) {
    trace(user, 'findUserByUsername: Finished users.like');
    return user;
  }

  return false;
}

// The main event:
try {
  if (argv.h || argv.help) {
    console.log(
      chalk.yellow`useradd [-u username] [-p password] [ -a (if you want user to have admin privileges to create other users)]`
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
    console.error(chalk.red`Username ${username} already exists`);
    process.exit(1);
  }

  const p = (argv.password ?? argv.p) as string | boolean | undefined;
  const password = p
    ? p === true
      ? await promptly.prompt('Password: ')
      : p
    : undefined;
  const isAdmin = Boolean(argv.a || argv.isadmin || argv.isAdmin);

  trace('Sending request to kafka');
  const user: User = {
    username,
    password,
    // Add scope if you want the user to have permission to create other users
    scope: isAdmin ? ['oada.admin.user:all'] : [],
  };
  const response = (await kafkareq.send({
    connection_id: 'useradd',
    token: 'admin',
    authorization: {
      scope: ['oada.admin.user:all'],
    },
    // The "user" key is what goes into the DB
    user,
  } as UserRequest)) as unknown as UserResponse;

  trace('Finished kafka.send, have our response = %O', response);
  // No need to keep hearing messages
  trace('Disconnecting from kafka');
  await kafkareq.disconnect();

  trace('Checking response.code, response = %O', response);
  if (response.code !== 'success') {
    console.error(
      chalk.red`FAILED TO RECEIVE SUCCESSFUL RESPONSE FROM USER SERVICE WHEN CREATING USER!`
    );
    process.exit(1);
  }

  // Now we have a user
  const su = response.user;
  console.info(chalk.green`User {cyan ${su!._id}} now exists`);
} catch (error: unknown) {
  console.error(error);
  process.exit(1);
}
