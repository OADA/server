#!/usr/bin/env node

const argv = require('minimist')(process.argv.slice(2));
const cloneDeep = require('clone-deep');
const chalk = require('chalk');

const { authorizations } = require('@oada/lib-arangodb');

// Add useradd:trace to enable tracing
if (!process.env.DEBUG) {
  process.env.DEBUG = 'extendToken:info,extendToken:error';
}

const debug = require('debug');
const trace = debug('extendToken:trace');
const info = debug('extendToken:info');

// The main event:
(async function () {
  // ./extendTime -n abc ==> should not have argv.n = 'abc'
  if (typeof argv.n === 'string') {
    argv._ = [argv.n];
    argv.n = true;
  }

  if (argv.h || argv.help || !argv._[0]) {
    return console.log(
      chalk.yellow(
        'extendToken [-e <new expiresIn>] [-c <new createTime>] [-n] <token>\nDefaults to expiresIn = 0 (never)\n-n: reset createTime to now\n'
      )
    );
  }

  const expiresIn = argv.e ? +argv.e : 0;
  const createTime = argv.n ? new Date().getTime() / 1000.0 : argv.c || false;
  const token = argv._[0]; // last argument is token

  const auth = await authorizations.findByToken(token);
  trace('Found auth, it is ', auth);

  const update = cloneDeep(auth);
  update.expiresIn = expiresIn;
  if (createTime) {
    update.createTime = createTime;
  }
  update.user = { _id: update.user._id }; // library filled this in, replace with just _id
  trace('Sending updated token as ', update);
  await authorizations.save(update);

  info(
    chalk.green(
      'Successfully updated token to expiresIn: ',
      expiresIn,
      !createTime ? '' : ', and createTime: ' + createTime
    )
  );
})();