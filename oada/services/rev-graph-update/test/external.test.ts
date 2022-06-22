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

import { setTimeout } from 'node:timers/promises';

import test, { ExecutionContext } from 'ava';

// DO NOT include ../ because we are testing externally.  Including here will cause admin copy of it
// to receive some of the kafka responses.

import { connect } from '@oada/client';

const contentType = 'application/vnd.oada.revgraphtest.1+json';
const topID = 'resources/REVGRAPHTEST_TOP1';
const middleID = 'resources/REVGRAPHTEST_MIDDLE1';
const bottomID = 'resources/REVGRAPHTEST_BOTTOM1';

const con = await connect({
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  domain: process.env.DOMAIN || 'localhost',
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  token: process.env.TOKEN || 'god',
});

test.beforeEach(async (t) => {
  await cleanup();
  await buildTree(t);
});

test.after(async () => cleanup());

test('Should properly update the _rev on parent when a child is changed', async (t) => {
  t.timeout(5000);
  const { data: toprev } = await con.get({ path: `${topID}/_rev` });
  await con.put({
    path: `/${bottomID}`,
    data: { change1: 'isdone' },
    contentType,
  });
  await setTimeout(500); // Give it a second to update the parent
  const { data: newtoprev } = await con.get({ path: `/${topID}/_rev` });
  t.is(newtoprev, Number(toprev) + 1);
});

test('Should set _rev to 0 on parent when child resource is deleted', async (t) => {
  t.timeout(5000);
  await con.delete({ path: `/${bottomID}` });
  await setTimeout(500); // Give it a second to update the parent
  const { data: middle } = await con.get({ path: `/${middleID}` });
  // @ts-expect-error nonsense
  t.is(middle?.bottom?._rev, 0);
});

test('Should not have infinite recursion when a deep loop is present', async (t) => {
  await con.put({
    path: `/${bottomID}`,
    data: { middle: { _id: middleID, _rev: 0 } },
  }); // Cycle middle -> bottom -> middle -> bottom -> ...
  // Write again to bottom just for good measure
  await con.put({ path: `/${bottomID}`, data: { change2: 'isdone' } });
  await setTimeout(500);
  const { data: newmiddlerev } = await con.get({ path: `/${middleID}/_rev` });
  t.is(newmiddlerev, 3);
});

async function buildTree(t: ExecutionContext) {
  try {
    await con.put({
      path: `/${bottomID}`,
      data: { iam: 'bottom' },
      contentType,
    });
    await con.put({
      path: `/${middleID}`,
      data: { iam: 'middle', bottom: { _id: bottomID, _rev: 0 } },
      contentType,
    });
    await con.put({
      path: `/${topID}`,
      data: { iam: 'top', middle: { _id: middleID, _rev: 0 } },
      contentType,
    });
  } catch (error: unknown) {
    t.log(error, 'FAILED TO BUILD TREE');
    throw error as Error;
  }
}

async function cleanup() {
  for await (const id of [topID, middleID, bottomID]) {
    try {
      await con.get({ path: `/${id}` });
      await con.delete({ path: `/${id}` });
    } catch {} // Do nothing, didn't exist
  }
}
