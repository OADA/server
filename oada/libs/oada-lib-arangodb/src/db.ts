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

import Bluebird from 'bluebird';
import { Database } from 'arangojs';

import config from './config';

const db = new Database({
  url: config.get('arangodb:connectionString'),
});

if (config.get('isTest')) {
  config.set('arangodb:database', 'oada-test');
}

db.database(config.get('arangodb:database'));

// Automatically retry queries on deadlock?
const deadlockRetries = config.get('arangodb:retry:deadlock:retries');
const deadlockDelay = config.get('arangodb:retry:deadlock:delay');
const DeadlockError = {
  name: 'ArangoError',
  errorNum: 29,
};
const query = db.query;
db.query = function (...args: Parameters<typeof query>) {
  let tries = 0;
  function tryquery(): ReturnType<typeof query> {
    return Bluebird.resolve(query.apply(db, args)).catch(
      DeadlockError,
      async (err: unknown) => {
        if (++tries >= deadlockRetries) {
          throw err;
        }

        //      warn(`Retrying query due to deadlock (retry #${tries})`, err);
        return Bluebird.delay(deadlockDelay).then(tryquery);
      }
    );
  }

  return tryquery();
} as typeof query;

export { db };
