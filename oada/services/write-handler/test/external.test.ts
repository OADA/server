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

import type { ExecutionContext } from 'ava';
import test from 'ava';

// DO NOT include ../ because we are testing externally.  Including here will cause admin copy of it
// to receive some of the kafka responses.

import type { Change } from '@oada/client';
import { connect } from '@oada/client';

const topID = `resources/WRITEHANDLERTEST_TOP1`;
const middleID = `resources/WRITEHANDLERTEST_MIDDLE1`;
const bottomID = `resources/WRITEHANDLERTEST_BOTTOM1`;

const con = await connect({
  domain: process.env.DOMAIN || 'localhost',

  token: process.env.TOKEN || 'god',
});

test.beforeEach(async (t) => {
  await cleanup();
  await buildTree(t);
});

//    After(async () => cleanup());

test('Should include the link key in the change document when deleting a link to a non-existent resource', async (t) => {
  t.timeout(2000);
  await con.put({
    path: `/${topID}`,
    data: { nonexistentlink: { _id: 'resources/DOESNOTEXIST', _rev: 0 } },
    contentType: 'application/json',
  });
  const { data: firstrev } = await con.get({ path: `/${topID}/_rev` });
  try {
    await con.delete({ path: `/${topID}/nonexistentlink` });
  } catch (error: unknown) {
    t.log(error, 'FAILED DELETE');
  }

  const { data: changedocs } = (await con.get({
    path: `/${topID}/_meta/_changes/${Number(firstrev) + 1}`,
  })) as unknown as { data: Change[] };
  const thechange = changedocs.find((c) => c.type === 'delete');

  t.is(thechange?.type, 'delete');
  t.is(thechange?.body?.nonexistentlink, null);
});

async function buildTree(t: ExecutionContext) {
  try {
    await con.put({
      path: `/${bottomID}`,
      data: { iam: 'bottom' },
      contentType: 'application/json',
    });
    await con.put({
      path: `/${middleID}`,
      data: { iam: 'middle', bottom: { _id: bottomID, _rev: 0 } },
      contentType: 'application/json',
    });
    await con.put({
      path: `/${topID}`,
      data: { iam: 'top', middle: { _id: middleID, _rev: 0 } },
      contentType: 'application/json',
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
    } catch {}
  }
}
