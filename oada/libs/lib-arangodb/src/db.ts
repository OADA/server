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

/* eslint-disable unicorn/prevent-abbreviations */

import { setTimeout } from 'node:timers/promises';

import config from './config.js';

import type { AqlQuery } from 'arangojs/aql';
import Bluebird from 'bluebird';
import { Database } from 'arangojs';
import type { QueryOptions } from 'arangojs/database';
import debug from 'debug';

const trace = debug('arangodb#aql:trace');

const { profile } = config.get('arangodb.aql');
class DatabaseWrapper extends Database {
  // @ts-expect-error nonsense
  override async query(query: AqlQuery, options: QueryOptions = {}) {
    let tries = 0;
    const tryquery: () => ReturnType<Database['query']> = async () =>
      // eslint-disable-next-line github/no-then
      Bluebird.resolve(super.query(query, { profile, ...options })).catch(
        DeadlockError,
        async (error: unknown) => {
          if (++tries >= deadlockRetries) {
            throw error;
          }

          // Warn(`Retrying query due to deadlock (retry #${tries})`, err);
          // There is no eval here...
          await setTimeout(deadlockDelay);
          return tryquery();
        }
      );

    const res = await tryquery();
    // TODO: Less gross way to do this?
    if (trace.enabled) {
      const { query: aql, ...rest } = query;
      trace({ ...rest, ...res.extra }, aql);
    }

    return res;
  }
}

if (config.get('isTest')) {
  config.set('arangodb.database', 'oada-test');
}

const database = new DatabaseWrapper({
  url: config.get('arangodb.connectionString'),
  databaseName: config.get('arangodb.database'),
});

// Automatically retry queries on deadlock?
const deadlockRetries = config.get('arangodb.retry.deadlock.retries');
const deadlockDelay = config.get('arangodb.retry.deadlock.delay');
// eslint-disable-next-line @typescript-eslint/naming-convention
const DeadlockError = {
  name: 'ArangoError',
  errorNum: 29,
};

export { database as db };
