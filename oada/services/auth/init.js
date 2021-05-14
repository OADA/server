// This file handles requiring and running the config.get("init") function
// whenever you call `npm run init`.  It's intended to be used to ensure
// your database exists, has proper indexes, and has any required or initial
// data in it.
//
// Be sure to write your init function such that it doesn't wipe out
// your entire database if it gets run over and over again.  That way
// it will work as a default script to run on every startup.

const debug = require('debug')('init');
const Bluebird = require('bluebird');
const config = require('./config');

const init_path = config.get('auth.init');
if (typeof init_path !== 'string' || init_path.length < 1) return;

const init = require(init_path); // nosemgrep: detect-non-literal-require
if (typeof init !== 'function')
  return debug('no intialization function available');

debug('Running init function from %s', init_path);
Bluebird.try(() => init(config)).then(() => debug('Initialization complete.'));
