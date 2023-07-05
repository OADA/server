/**
 * @license
 * Copyright 2017-2022 Open Ag Data Alliance
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

import { config } from '../dist/config.js';

import test from 'ava';

import { Database } from 'arangojs';

import { cleanup, run } from '../dist/init.js';

// eslint-disable-next-line @typescript-eslint/ban-ts-comment, @typescript-eslint/prefer-ts-expect-error
// @ts-ignore
const databaseName = config.get('arangodb.database');

const arangodb = new Database({
  url: config.get('arangodb.connectionString'),
});
// Const cleanup = init.cleanup; // set this to an empty function if you don't want db to be deleted

test.afterEach(async () => {
  await cleanup();
});

test('should drop test database if it already exists', async (t) => {
  arangodb.database('_system');

  const dbs = await arangodb.listDatabases();
  for await (const database of dbs) {
    if (database === databaseName) {
      await arangodb.dropDatabase(databaseName);
    }
  }

  await arangodb.createDatabase(databaseName);

  arangodb.database(databaseName);
  await arangodb.collection('dummycollection').create();

  await run();

  const cols = await arangodb.listCollections();
  for (const col of cols) {
    t.not(col.name, 'dummycollection');
  }
});

test(`should create test database ${databaseName}`, async (t) => {
  await run();

  arangodb.database('_system');

  const dbs = await arangodb.listDatabases();

  // Expect one of the database names returned to be the database name
  for (const database of dbs) {
    if (database === databaseName) {
      t.pass();
      return;
    }
  }

  t.fail();
});

test('should have created all the collections', async (t) => {
  await run();

  arangodb.database(databaseName);
  const databaseCols = await arangodb.listCollections();
  const cols = config.get('arangodb.collections');
  // Expect the returned list of db collections to contain each name
  for (const col of Object.values(cols)) {
    const hasname = databaseCols.some((d) => d.name === col.name);
    t.true(hasname);
  }
});

test('should create all the indexes on the collections', async (t) => {
  await run();

  arangodb.database(databaseName);
  const colsarr = Object.values(config.get('arangodb.collections'));
  for await (const c of colsarr) {
    const databaseIndexes = await arangodb.collection(c.name).indexes();

    for (const ci of c.indexes) {
      // For each index in collection, check if exists
      const indexname = typeof ci === 'string' ? ci : ci.name.toString();
      const hasindex = databaseIndexes.some((dbi) =>
        dbi.fields.includes(indexname),
      );

      t.true(hasindex);
    }
  }
});

test('should create any requested default data', async (t) => {
  await run();
  arangodb.database(databaseName);
  const defaults = config.get('arangodb.init.defaultData');
  const defaultdata = Object.fromEntries(
    await Promise.all(
      Object.entries(defaults).map(async ([k, v]) => {
        const { default: value } = (await import(`../${v}`)) as {
          default: unknown[];
        };
        return [k, value] as [string, unknown[]];
      }),
    ),
  );

  for await (const [colname, data] of Object.entries(defaultdata)) {
    for await (const document of data) {
      if (colname === 'users') {
        // @ts-expect-error idk?
        delete document.password; // Don't bother to check hashed password
      }

      const example: unknown = await arangodb
        .collection(colname)
        .firstExample(document as any);
      t.like(example, document as Record<string, unknown>);
    }
  }
});
