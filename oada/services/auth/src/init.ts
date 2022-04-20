/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
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

// whenever you call `npm run init`.  It's intended to be used to ensure
// your database exists, has proper indexes, and has any required or initial
// data in it.
//
// Be sure to write your init function such that it doesn't wipe out
// your entire database if it gets run over and over again.  That way
// it will work as a default script to run on every startup.

import { config } from './config.js';

import debug from 'debug';

const log = debug('init');

const initPath = config.get('auth.init');
if (initPath) {
  const { default: init } = (await import(initPath)) as {
    default: (argument: typeof config) => Promise<void>;
  }; // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require

  if (typeof init === 'function') {
    log('running init function from %s', initPath);
    await init(config);
    log('initialization complete.');
  } else {
    log('No initialization function available');
  }
}
