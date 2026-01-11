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

import { aql, Database } from "arangojs";
import debug from "debug";
import pThrottle from "p-throttle";
import { config } from "./config.js";

import { db as database } from "./db.js";

const info = debug("@oada/lib-arangodb:import:info");
const trace = debug("@oada/lib-arangodb:import:trace");
const error = debug("@oada/lib-arangodb:import:error");

//const LIMIT = 1000;

const {
  auth,
  connectionString: url,
  database: databaseName,
  batchSize,
  batchThrottle,
  overwriteMode,
} = config.get("arangodbImport");

const collections = await database.collections();

const throttle = pThrottle(batchThrottle);
const throttled = throttle(async () => {});

// @ts-expect-error type bs
const importDatabase = new Database({
  auth,
  url,
  databaseName,
  precaptureStackTraces: true,
  keepalive: true,
  /*
  beforeRequest: (req) => trace({ req }, "requesting"),
  afterResponse: (err, res) => trace({ err, res }, "received"),
  */
});

interface T {
  _id: string;
  _key: string;
}

for await (const { name } of Object.values(collections)) {
  try {
    const importCollection = importDatabase.collection<T>(name);

    /*
    trace(`Querying already imported documents for ${name}`);
    const done = await database.query<string>(
      aql`
      FOR doc IN ${importCollection}
        RETURN doc._id
      `,
      {
        batchSize,
        ttl: 60 * 60 * 10,
        //allowRetry: true,
        //cache: false,
        //fillBlockCache: false,
        stream: true,
        allowDirtyRead: true,
        count: true,
      },
    );
    */

    //const importedIds = await done.all();
    trace(`Querying all new documents for ${name}`);
    const collection = database.collection<T>(name);
    let imported = 0;
    try {
      const all = await importDatabase.query(
        aql`
      FOR doc IN ${importCollection}
        RETURN doc
      `,
        {
          batchSize,
          ttl: 60 * 60 * 10,
          //allowRetry: true,
          //cache: false,
          //fillBlockCache: false,
          stream: true,
          allowDirtyRead: true,
          count: true,
        },
      );
      for await (const batch of all.batches) {
        trace({ batch, imported, count: all.count }, "Importing batch");
        await collection.import(batch, {
          complete: true,
          onDuplicate: overwriteMode,
          // waitForSync: true,
        });
        imported += batch.length;
      }
    } catch (err: unknown) {
      error(err, "Error in batch import, attempting one at a time");
      const all = await importDatabase.query<string>(
        aql`
          FOR doc IN ${importCollection}
            RETURN doc._id
        `,
        {
          batchSize,
          ttl: 60 * 60 * 10,
          //allowRetry: true,
          //cache: false,
          //fillBlockCache: false,
          stream: true,
          allowDirtyRead: true,
          count: true,
        },
      );
      //const remainingIds = await all.all();
      /*
      try {
        const docs = await importCollection.documents(remainingIds);
        trace({ docs, count: remainingIds.length }, "batch importing docs");
        await collection.import(docs, {
          waitForSync: true
        });
      } catch (err: unknown) {
        error(err, "Error in batch import, attempting one at a time");
        */
        try {
          for await (const batch of all.batches) {
            const docs = await importCollection.documents(batch);
            trace({ docs, imported, count: all.count }, "importing docs");
            await collection.import(docs, {
              complete: true,
              onDuplicate: overwriteMode,
              // waitForSync: true,
            });
            imported += batch.length;
            await throttled();
          }
        } catch (err: unknown) {
          error(err, "Error in batch import, attempting one at a time");
          for await (const id of all) {
            const doc = await importCollection.document(id);
            trace({ doc, imported, count: all.count }, "importing doc");
            await collection.save(doc, {
              overwriteMode,
              // waitForSync: true,
            });
            imported += 1;
            await throttled();
          }
        }
      }
    //}

    info(`${imported} documents imported from collection ${name}`);
  } catch (cError: unknown) {
    error(cError, `Error importing collection ${name}`);
  }
}
