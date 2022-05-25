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

import { config } from './config.js';

import { ArangoError, ArangoErrorCode } from './libs/errors.js';

import type { AqlQuery } from 'arangojs/aql';
import { Database } from 'arangojs';
import type { QueryOptions } from 'arangojs/database';
import debug from 'debug';

const trace = debug('arangodb#aql:trace');
const warn = debug('arangodb#aql:warn');

const { profile } = config.get('arangodb.aql');
const deadlockRetries = config.get('arangodb.retry.deadlock.retries');
const deadlockDelay = config.get('arangodb.retry.deadlock.delay');

class DatabaseWrapper extends Database {
  // @ts-expect-error nonsense
  override async query(query: AqlQuery, options: QueryOptions = {}) {
    let tries = 0;
    while (++tries) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const res = await super.query(query, { profile, ...options });
        if (trace.enabled) {
          const { query: aql, ...rest } = query;
          trace({ ...rest, ...res.extra }, aql);
        }

        return res;
      } catch (error: unknown) {
        // Automatically retry queries on deadlock?
        if (
          error instanceof ArangoError &&
          // DeadlockError
          error.errorNum === ArangoErrorCode.DEADLOCK &&
          tries <= deadlockRetries
        ) {
          warn({ error }, `Retrying query due to deadlock (retry #${tries})`);
          // eslint-disable-next-line no-await-in-loop
          await setTimeout(deadlockDelay);
          continue;
        }

        // ???: Should this be a trace, a warn, or an error??
        if (warn.enabled) {
          const { query: aql, ...rest } = query;
          warn({ error, ...rest }, `AQL Query failed:\n${aql}`);
        }

        throw error as Error;
      }
    }

    return undefined as never;
  }
}

if (config.get('isTest')) {
  config.set('arangodb.database', 'oada-test');
}

const database = new DatabaseWrapper({
  url: config.get('arangodb.connectionString'),
  databaseName: config.get('arangodb.database'),
  precaptureStackTraces: process.env.NODE_ENV !== 'production',
});

export { database as db };
