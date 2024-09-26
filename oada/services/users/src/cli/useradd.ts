/**
 * @license
 * Copyright 2017-2024 Open Ag Data Alliance
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

 

import '@oada/pino-debug';

import {
  type Type,
  array,
  binary,
  boolean,
  command,
  flag,
  multioption,
  option,
  optional,
  run,
  string,
} from 'cmd-ts';
import chalk from 'chalk';

import { config } from '../config.js';

import { Requester } from '@oada/lib-kafka';
import User from '@oada/models/user';
import { users } from '@oada/lib-arangodb';

import type { UserRequest, UserResponse } from '../server.js';

import esMain from 'es-main';

// eslint-disable-next-line @typescript-eslint/naming-convention
const UserType: Type<string, User> = {
  // eslint-disable-next-line @typescript-eslint/require-await
  async from(username) {
    return new User({ username });
  },
};

export const cmd = command({
  name: 'useradd',
  description: 'add a user to OADA',
  args: {
    user: option({
      type: UserType,
      long: 'user',
      short: 'u',
    }),
    password: option({
      type: string,
      defaultValue: () => process.env.PASSWORD ?? '',
      long: 'password',
      short: 'p',
    }),
    admin: flag({
      type: optional(boolean),
      long: 'admin',
      short: 'a',
      description: 'Admin role',
    }),
    roles: multioption({
      type: array(string),
      long: 'roles',
      short: 'r',
      description: 'User roles to assign',
    }),
    domain: option({
      type: string,
      long: 'domain',
      defaultValue: () => process.env.DOMAIN ?? '',
      short: 'd',
    }),
  },
  async handler({ user: u, password, admin = false, roles = [], domain }) {
    const found = await users.findByUsername(u.username);
    if (found) {
      throw new Error(`User ${found.username} already exists`);
    }

    // -------------------------------------
    // Talk to user service over Kafka...
    // Produce a request to the user service to create one for us:
    const kafkareq = new Requester({
      // Topic to look for final answer on (consume):
      consumeTopic: config.get('kafka.topics.httpResponse'),
      // Topic to send request on (produce):
      produceTopic: config.get('kafka.topics.userRequest'),
      // Group name
      group: 'useradd',
    });

    try {
      if (admin) {
        roles.push('oada.admin.user:all');
      }

      const user = {
        ...u,
        domain,
        password,
        roles,
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

      if (response.code !== 'success') {
        throw new Error(`Creating user failed with code: ${response.code}`);
      }

      // Now we have a user
      const su = response.user;
      console.log(chalk.green`User {cyan ${su!.sub}} now exists`);
    } finally {
      await kafkareq.disconnect();
    }
  },
});

if (esMain(import.meta)) {
  await run(binary(cmd), process.argv);
}
