/* Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import debug from 'debug';
import minimist from 'minimist';
import promptly from 'promptly';
import chalk from 'chalk';

import { users } from '@oada/lib-arangodb';
import { Requester } from '@oada/lib-kafka';

import type { UserResponse } from './server';
import config from './config';

const argv = minimist(process.argv.slice(2));

const trace = debug('useradd:trace');

async function findUserByUsername(username: string) {
  const all_users = await users.like({ username });
  trace('findUserByUsername: Finished users.like, all_users = %O', all_users);
  return all_users?.length > 0 ? all_users[0] : false;
}

// The main event:
async function run() {
  try {
    if (argv.h || argv.help) {
      console.log(
        chalk.yellow(
          'useradd [-u username] [-p password] [-d domain.com] [ -a (if you want user to have admin priviledges to create other users)]'
        )
      );
      return;
    }

    //-----------------------------------------------------
    // Ensure we have a username and password...
    const username =
      argv.u || argv.username || (await promptly.prompt('Username: '));
    if (await findUserByUsername(username)) {
      console.error(chalk.red('Username ' + username + ' already exists'));
      process.exit(1);
    }
    const password =
      argv.p || argv.password || (await promptly.prompt('Password: '));
    const domain =
      argv.d ||
      argv.domain ||
      (await promptly.prompt('Domain (without the https://): '));
    const isadmin = !!(argv.a || argv.isadmin || argv.isAdmin);

    //-------------------------------------
    // Talk to user service over Kafka...
    trace('Creating kafka requester...');
    // Produce a request to the user service to create one for us:
    const kafkareq = new Requester({
      // Topic to look for final answer on (consume):
      consumeTopic: config.get('kafka.topics.httpResponse'),
      // Topic to send request on (produce):
      produceTopic: config.get('kafka.topics.userRequest'),
      // group name
      group: 'useradd',
    });

    trace('Sending request to kafka');
    const response = ((await kafkareq.send({
      connection_id: 'useradd',
      domain,
      token: 'admin',
      authorization: {
        scope: ['oada.admin.user:all'],
      },
      // the "user" key is what goes into the DB
      user: {
        username,
        password,
        // Add scope if you want the user to have permission to create other users
        scope: isadmin ? ['oada.admin.user:all'] : [],
      },
    })) as unknown) as UserResponse;

    trace('Finished kafka.send, have our response = %O', response);
    // no need to keep hearing messages
    trace('Disconnecting from kafka');
    await kafkareq.disconnect();

    trace('Checking response.code, response = %O', response);
    if (response.code !== 'success') {
      console.error(
        chalk.red(
          'FAILED TO RECEIVE SUCCESSFUL RESPONSE FROM USER SERVICE WHEN CREATING USER!'
        )
      );
      return;
    }

    // Now we have a user
    const su = response.user;
    console.info(
      chalk.green('User ') +
        chalk.cyan(su._id) +
        chalk.green(' now exists: ') +
        su?._id
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
  process.exit(0);
}

run();
