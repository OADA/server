#!/usr/bin/env node

/* eslint no-console: off, no-process-exit: off -- This is a cli command */

const argv = require('minimist')(process.argv.slice(2));
const cloneDeep = require('clone-deep');
const chalk = require('chalk');
const uuid = require('uuid');

const { authorizations, users } = require('@oada/lib-arangodb');

const debug = require('debug');
const trace = debug('token:trace');

const usage = () => {
  const ye = chalk.yellow;
  console.error(
    ye(
      'USAGE: node token.js <extend | create | disable> [-e <new expiresIn>] [-c <new createTime> | -n] [-u <userid | username>] [-s <scope_str>] [token]'
    )
  );
  console.error('extend:');
  console.error(
    '\t-e expiresIn: milliseconds (Defaults to expiresIn = 0 (never))'
  );
  console.error('\t-n: set createTime to now');
  console.error('\t-c <time>: set createTime to <time>');
  console.error('\t<token>: last arg must be the token you want to extend');
  console.error('create:');
  console.error(
    '\t-u <userid | username>: create token for user if it has a slash, it is assumed to be a userid (like users/12345).  Otherwise, it is assumed to be a username.'
  );
  console.error(
    '\t-s <scope_string>: comma-separated list of scopes, defaults to all:all'
  );
  console.error('disable:');
  console.error('\t<token>: disable <token> by making it expired');
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
async function run() {
  // ./extendTime -n abc ==> should not have argv.n = 'abc'
  if (typeof argv.n === 'string') {
    trace('have -n, fixing argv.');
    argv._ = [...argv._, argv.n];
    argv.n = true;
  }

  if (argv.h || argv.help || !argv._[0]) {
    trace('Help:');
    return usage();
  }

  const getNow = () => {
    return new Date().getTime() / 1000.0;
  };

  const extend = async () => {
    trace('Running extend');
    const expiresIn = argv.e ? +argv.e : 0;
    const createTime = argv.n ? getNow() : argv.c ? argv.c : false;
    const token = argv._[argv._.length - 1]; // last argument is token

    const auth = await authorizations.findByToken(token);
    trace('Found auth, it is ', auth);

    const update = cloneDeep(auth);
    update.expiresIn = expiresIn;
    if (createTime) {
      update.createTime = createTime;
    }
    update.user = { _id: update.user._id }; // library filled this in, replace with just _id
    return update;
  };

  const create = async () => {
    trace('Running create');
    if (!argv.u) {
      console.error(
        'You must provide a userid (users/123) or a username (bob)'
      );
      return usage();
    }
    let userid = argv.u;
    // If there is not a slash in the -u argument's value, assume we need to lookup userid for this username
    if (!userid.match(/\//)) {
      const u = await users.findByUsername(userid);
      userid = u._id;
      if (!userid) {
        console.error('Unable to find username ' + argv.u + '.  Aborting.');
        return;
      }
      console.info(`Looked up username ${argv.u} and found userid ${userid}`);
    }

    const scope = argv.s ? argv.s.split(',') : ['all:all'];
    const createTime = argv.c ? argv.c : getNow();
    const expiresIn = argv.e ? argv.e : 0; // Default does not expire
    const clientId = 'system/token';
    const token = uuid.v4().replace(/-/g, '');
    return {
      token,
      scope,
      createTime,
      expiresIn,
      user: { _id: userid },
      clientId,
    };
  };

  const disable = async () => {
    const token = argv._[argv._.length - 1]; // last argument is token

    const auth = await authorizations.findByToken(token);
    trace('Found auth, it is ', auth);

    const update = cloneDeep(auth);
    update.createTime = getNow();
    update.expiresIn = 1;
    return update;
  };

  let update = null;
  trace('argv._[0] = ', argv._[0]);
  switch (argv._[0]) {
    case 'extend':
      update = await extend();
      break;
    case 'create':
      update = await create();
      break;
    case 'disable':
      update = await disable();
      break;
    default:
      return usage();
  }
  if (update) {
    trace('Sending updated token as ', update);
    await authorizations.save(update);
    console.info(chalk.green(`Successfully wrote token ${update.token}`));
  }
}
run();
