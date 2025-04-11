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

import test from "ava";

import { run } from "../dist/init.js";
import { lookupFromUrl } from "../dist/libs/resources.js";

// Library under test:

// Tests for the arangodb driver:

const userid = "user/default:sam_123";

const rockUrl =
  "/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss";
const rockResourceId = "resources/default:resources_rock_123";

const rocksIndexUrl =
  "/resources/default:resources_bookmarks_123/rocks/rocks-index";
const rocksIndexResourceId = "resources/default:resources_rocks_123";
const rocksIndexPathLeft = "/rocks-index";

const rockPickedUrl =
  "/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss/picked_up";
const rockPickedPathLeft = "/picked_up";

test.before(async (t) => {
  // Create the test database (with necessary collections and dummy data)
  try {
    await run();
  } catch (error: unknown) {
    t.log("FAILED to initialize graph-lookup tests by creating database");
    t.log(error, "The error");
  }
});

// -------------------------------------------------------
// After tests are done, get rid of our temp database
// -------------------------------------------------------
test.after(() => {
  //    Db.useDatabase('_system') // arango only lets you drop a database from the _system db
  //   return db.dropDatabase(dbname)
  //   .then(() => { console.log('Successfully cleaned up test database '+dbname) })
  //   .catch(err => console.log('Could not drop test database '+dbname+' after the tests! err = ', err))
});

// --------------------------------------------------
// The tests!
// --------------------------------------------------

test("should be able to return the resource id from a url", async (t) => {
  const result = await lookupFromUrl(rockUrl, userid);
  t.is(result.resource_id, rockResourceId);
});

test("should also return the leftover path for non-resource URLs", async (t) => {
  const result = await lookupFromUrl(rockPickedUrl, userid);
  t.is(result.resource_id, rockResourceId);
  t.is(result.path_leftover, rockPickedPathLeft);

  const result2 = await lookupFromUrl(rocksIndexUrl, userid);
  t.is(result2.resource_id, rocksIndexResourceId);
  t.is(result2.path_leftover, rocksIndexPathLeft);
});
