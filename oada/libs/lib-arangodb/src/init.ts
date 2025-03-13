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

/**
 * @packageDocumentation
 *
 * This file exports a function which can be used to initialize the database
 * with `yarn run init`.
 */

import { config } from "./config.js";
import { hashPw } from "./libs/users.js";

import { Database } from "arangojs";
import debug from "debug";
import equal from "deep-equal";

const trace = debug("arango:init:trace");
const warn = debug("arango:init:warn");
const info = debug("arango:init:info");

// ------------------------------------------------------------
// First setup some shorter variable names:
const databaseName = config.get("arangodb.database");
const auth = config.get("arangodb.auth");
const cols = config.get("arangodb.collections");
const colsarr = Object.values(cols);

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function run(): Promise<void> {
  // Can't use ./db because we're creating the actual database
  const systemDB = new Database({
    url: config.get("arangodb.connectionString"),
    auth,
  });

  try {
    const ensureDefaults = config.get("arangodb.ensureDefaults");
    trace(
      `ensureDefaults = %s` +
        "==> false means it will delete default doc._id's from all collections if they exist, " +
        "and true means it will add them if they do not exist",
      ensureDefaults,
    );

    trace("Checking if database exists");
    // ---------------------------------------------------------------------
    // Start the show: Figure out if the database exists
    const dbs = await systemDB.listDatabases();
    if (dbs.includes(databaseName)) {
      if (
        (!config.get("isProduction") && process.env.RESETDATABASE === "yes") ||
        config.get("isTest")
      ) {
        trace(
          'isProduction is false and process.env.RESETDATABASE is "yes"' +
            "dropping database and recreating",
        );
        await systemDB.dropDatabase(databaseName);
        await systemDB.createDatabase(databaseName);
      }

      info(
        "isProduction is %s and process.env.RESETDATABASE is %s, not dropping database.",
        config.get("isProduction"),
        process.env.RESETDATABASE,
      );
      // Otherwise, not test so don't drop database
      trace("database %s exists", databaseName);
    } else {
      trace("Database %s does not exist. Creating...", databaseName);
      await systemDB.createDatabase(databaseName);
      trace("Now %s database exists", databaseName);
    }

    // ---------------------------------------------------------------------
    // Use that database, then check that all the collections exist
    trace("Using database %s", databaseName);
    const database = systemDB.database(databaseName);
    try {
      const databaseCols = await database.listCollections();
      trace("Found collections, looking for the ones we need");
      for await (const c of colsarr) {
        if (databaseCols.some((d) => d.name === c.name)) {
          trace("Collection %s exists", c.name);
          continue;
        }

        if (c.edgeCollection) {
          await database.createEdgeCollection(c.name);
          trace("Edge collection %s has been created", c.name);
        } else {
          c.createOptions ||= {};

          await database.createCollection(c.name, c.createOptions);
          trace("Document collection %s has been created", c.name);
        }
      }

      // ---------------------------------------------------------------------
      // Now check if the proper indexes exist on each collection:
      for await (const c of colsarr) {
        const databaseIndexes = await database.collection(c.name).indexes();
        // For each index in this collection, check and create
        for await (const ci of c.indexes) {
          const indexname = typeof ci === "string" ? ci : ci.name;
          const unique = typeof ci === "string" ? true : ci.unique;
          const sparse = typeof ci === "string" ? true : ci.sparse;
          if (databaseIndexes.some((dbi) => equal(dbi.fields, [indexname]))) {
            trace("Index %s exists on collection %s", indexname, c.name);
            continue;
          }

          // Otherwise, create the index
          trace("Creating %s index on %s", indexname, c.name);
          const fields = Array.isArray(indexname) ? indexname : [indexname];
          await database.collection(c.name).ensureIndex({
            type: "persistent",
            cacheEnabled: true,
            fields,
            unique,
            sparse,
          });
          trace("Created %s index on %s", indexname, c.name);
        }

        // ----------------------------------------------------------------------
        // Finally, import default data if they want some:
      }

      for await (const [colname, colinfo] of Object.entries(
        config.get("arangodb.collections"),
      )) {
        trace("Setting up collection %s: %O", colname, colinfo);
        if (typeof colinfo.defaults !== "string") {
          continue; // Nothing to import for this colname
        }

        const { default: data } = (await import(colinfo.defaults)) as {
          default: Array<{ _id: string; _key: string; password?: string }>;
        };
        // Override global ensureDefaults if this column explicitly specifies a value for it:
        const colSpecificEnsureDefaults =
          colinfo.ensureDefaults ?? ensureDefaults;

        // TODO: clean up this any nonsense
        for await (const document of data) {
          if (!document?._id) {
            warn("doc is undefined for collection %s", colinfo.name);
          }

          // Have to use _key if we want the key to be our key:
          document._key ||= document._id?.replace(/^[^/]*\//, "");

          if (
            colname === "users" && // Oidc users don't have password, so you need to check for existence
            document.password
          ) {
            document.password = await hashPw(document.password);
          }

          try {
            const databaseDocument: unknown = await database
              .collection(colname)
              .document(document._id);
            if (colSpecificEnsureDefaults) {
              trace(
                "Default data document %s already exists on collection %s, " +
                  "leaving it alone because ensureDefaults is truthy",
                document._id,
                colname,
              );
              continue;
            }

            info(
              "Default data document %s exists on collection %s" +
                ", and ensureDefaults is falsy, " +
                "so we are DELETING THIS DOCUMENT FROM THE DATABASE! " +
                "Before deleting, its value in the database was: %O",
              document._id,
              colname,
              databaseDocument,
            );
            try {
              await database.collection(colname).remove(document._key);
            } catch (error: unknown) {
              warn(
                "Failed to remove default doc %s from collection %s. Error was: %O",
                document._key,
                colname,
                error,
              );
            }
          } catch {
            if (colSpecificEnsureDefaults) {
              info(
                "Document %s does not exist in collection %s. Creating...",
                document._key,
                colname,
              );
              await database.collection(colname).save(document);
              trace(
                "Document %s successfully created in collection %s",
                document._id,
                colname,
              );
            } else {
              trace(
                "Default document %s does not exist in collection %s so there is nothing else to do for this one.",
                document._key,
                colname,
              );
            }
          }
        }
      }

      for await (const [name, options] of Object.entries(
        config.get("arangodb.graphs"),
      )) {
        const graph = database.graph(options.name);
        if (await graph.exists()) {
          trace("Skipping pre-existing graph %s", name);
          continue;
        }

        trace("Initializing graph %s", name);
        const edges = options.edges.map(({ collection, to, from }) => ({
          // Resolve collection names based on collections config
          collection: config.get(
            `arangodb.collections.${collection as string}.name`,
          ),
          to: config.get(`arangodb.collections.${to as string}.name`),
          from: config.get(`arangodb.collections.${from as string}.name`),
        }));
        await graph.create(edges);
      }
    } finally {
      database.close();
    }
  } finally {
    systemDB.close();
  }
}

// Cleanup will delete the test database if in test mode
export async function cleanup(): Promise<void> {
  // Can't use ./db because we're creating the actual database
  const systemDB = new Database({
    url: config.get("arangodb.connectionString"),
  });

  try {
    if (config.get("isProduction")) {
      throw new Error(
        "Cleanup called, but isProduction is true!" +
          " Cleanup only deletes the database when testing.",
      );
    }

    // Arango only lets you drop databases from _system
    trace(
      "Cleaning up by dropping test database %s",
      config.get("arangodb.database"),
    );
    await systemDB.dropDatabase(config.get("arangodb.database"));
    trace("Database %s dropped successfully", config.get("arangodb.database"));
  } finally {
    systemDB.close();
  }
}

export { config } from "./config.js";
