#!/usr/bin/env node

const config = require('@oada/lib-config')(
  require('/oada-srvc-docker-config.js')
);

const argv = require('minimist')(process.argv.slice(2));
const promptly = require('promptly');
const chalk = require('chalk');

const { users } = require('@oada/lib-arangodb');
const Requester = require('@oada/lib-kafka').Requester;

// Add useradd:trace to enable tracing
process.env.DEBUG = 'useradd:info,useradd:error';

const debug = require('debug');
const error = debug('useradd:error');
const trace = debug('useradd:trace');
const info = debug('useradd:info');

async function findUserByUsername(username) {
  const all_users = await users.like({ username });
  trace('findUserByUsername: Finished users.like, all_users = ', all_users);
  return all_users && all_users.length > 0 ? all_users[0] : false;
}

// The main event:
(async function () {
  if (argv.h || argv.help) {
    console.log(
      chalk.yellow(
        'useradd [-u username] [-p password] [-d domain.com] [ -a (if you want user to have admin priviledges to create other users)]'
      )
    );
  }

  //-----------------------------------------------------
  // Ensure we have a username and password...
  const username =
    argv.u || argv.username || (await promptly.prompt('Username: '));
  if (await findUserByUsername(username)) {
    error(chalk.red('Username ' + username + ' already exists'));
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
    consumeTopic: config.get('kafka:topics:httpResponse'),
    // Topic to send request on (produce):
    produceTopic: config.get('kafka:topics:userRequest'),
    // group name
    group: 'useradd',
  });

  trace('Sending request to kafka');
  let su = false;
  const response = await kafkareq.send({
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
  });

  trace('Finished kafka.send, have our response = ', response);
  // no need to keep hearing messages
  trace('Disconnecting from kafka');
  await kafkareq.disconnect();

  trace('Checking response.code, response = ', response);
  if (response.code !== 'success') {
    error(
      chalk.red(
        'FAILED TO RECEIVE SUCCESSFUL RESPONSE FROM USER SERVICE WHEN CREATING USER!'
      )
    );
    return;
  }

  // Now we have a user
  su = response.user;
  info(
    chalk.green('User ') + chalk.cyan(su._id) + chalk.green(' now exists: '),
    su && su._id
  );

  // Not sure why we have to process.exit instead of just returning...
  process.exit(0);
})();
