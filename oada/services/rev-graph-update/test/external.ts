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

import { expect } from 'chai';
import Bluebird from 'bluebird';

// DO NOT include ../ because we are testing externally.  Including here will cause admin copy of it
// to receive some of the kafka responses.

import oada, { OADAClient } from '@oada/client';

const contentType = 'application/vnd.oada.revgraphtest.1+json';
const topid = `resources/REVGRAPHTEST_TOP1`;
const middleid = `resources/REVGRAPHTEST_MIDDLE1`;
const bottomid = `resources/REVGRAPHTEST_BOTTOM1`;

let con: OADAClient;
describe('External tests of rev-graph-update, run from admin', () => {
  before(async () => {
    con = await oada.connect({ domain: 'proxy', token: 'god-proxy' });
  });

  beforeEach(async () => {
    await cleanup();
    await buildTree();
  });

  after(async () => cleanup());

  it('Should properly update the _rev on parent when a child is changed', async function () {
    this.timeout(5000);
    const toprev = (await con
      .get({ path: `${topid}/_rev` })
      .then((r) => r.data)) as number;
    await con.put({
      path: `/${bottomid}`,
      data: { change1: 'isdone' },
      contentType,
    });
    await Bluebird.delay(500); // Give it a second to update the parent
    const newtoprev = await con
      .get({ path: `/${topid}/_rev` })
      .then((r) => r.data);
    expect(newtoprev).to.equal(toprev + 1);
  });

  it('Should set _rev to 0 on parent when child resource is deleted', async function () {
    this.timeout(5000);
    await con.delete({ path: `/${bottomid}` });
    await Bluebird.delay(500); // Give it a second to update the parent
    const middle = (await con
      .get({ path: `/${middleid}` })
      .then((r) => r.data)) as any;
    expect(middle?.bottom?._rev).to.deep.equal(0);
  });

  it('Should not have infinite recursion when a deep loop is present', async () => {
    await con.put({
      path: `/${bottomid}`,
      data: { middle: { _id: middleid, _rev: 0 } },
    }); // Cycle middle -> bottom -> middle -> bottom -> ...
    // Write again to bottom just for good measure
    await con.put({ path: `/${bottomid}`, data: { change2: 'isdone' } });
    await Bluebird.delay(500);
    const newmiddlerev = await con
      .get({ path: `/${middleid}/_rev` })
      .then((r) => r.data);
    expect(newmiddlerev).to.equal(3);
  });
});

async function buildTree() {
  try {
    await con.put({
      path: `/${bottomid}`,
      data: { iam: 'bottom' },
      contentType,
    });
    await con.put({
      path: `/${middleid}`,
      data: { iam: 'middle', bottom: { _id: bottomid, _rev: 0 } },
      contentType,
    });
    await con.put({
      path: `/${topid}`,
      data: { iam: 'top', middle: { _id: middleid, _rev: 0 } },
      contentType,
    });
  } catch (error) {
    console.log('FAILED TO BUILD TREE.  ERROR =', error);
    throw error;
  }
}

async function cleanup() {
  await Bluebird.each([topid, middleid, bottomid], async (id) => {
    await con
      .get({ path: `/${id}` })
      .then(async () => con.delete({ path: `/${id}` })) // Delete it
      .catch(() => {}); // Do nothing, didn't exist
  });
}
