/**
 * @license
 * Copyright 2023 Open Ag Data Alliance
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

import { config } from './config.js';

import { Database, aql } from 'arangojs';
import debug from 'debug';

import { db as database } from './db.js';

const info = debug('@oada/lib-arangodb:import:info');
const trace = debug('@oada/lib-arangodb:import:trace');

const {
  auth,
  connectionString: url,
  database: databaseName,
  batchSize,
  overwriteMode,
} = config.get('arangodbImport');

const collections = config.get('arangodb.collections');

const importDatabase = new Database({
  auth,
  url,
  databaseName,
  precaptureStackTraces: true,
});

interface T {
  _id: string;
  _key: string;
}

for await (const { name } of Object.values(collections)) {
  trace(`Starting to import collection ${name}`);
  const importCollection = importDatabase.collection<T>(name);
  const cursor = await importDatabase.query<T>(
    aql`
    FOR doc IN ${importCollection}
      RETURN doc
  `,
    {
      batchSize,
      ttl: 60 * 60 * 10,
      allowRetry: true,
      cache: false,
      fillBlockCache: false,
      stream: true,
    },
  );

  const collection = database.collection<T>(name);
  let imported = 0;
  try {
    for await (const documents of cursor.batches) {
      trace({ imported, docs: documents }, 'importing docs');
      await collection.import(documents, {
        waitForSync: true,
        onDuplicate: overwriteMode,
      });
      imported += documents.length;
    }
  } finally {
    try {
      await cursor.kill();
    } catch {}
  }

  info(`${imported} documents imported from collection ${name}`);
}
