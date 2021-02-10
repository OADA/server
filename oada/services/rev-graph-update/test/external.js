/* Copyright 2017 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 )* limitations under the License.
 */

'use strict';

const _ = require('lodash');
const expect = require('chai').expect;
const Promise = require('bluebird');
const config = require('../config');
const debug = require('debug');
const trace = debug('trace:rev-graph-update#test');

// DO NOT include ../ because we are testing externally.  Including here will cause admin copy of it
// to receive some of the kafka responses.

const oada = require('@oada/client');

const headers = { 'content-type': 'application/vnd.oada.revgraphtest.1+json' };
const topid = `resources/REVGRAPHTEST_TOP1`;
const middleid = `resources/REVGRAPHTEST_MIDDLE1`;
const bottomid = `resources/REVGRAPHTEST_BOTTOM1`;

let con = false;
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
    const toprev = await con.get({ path: `${topid}/_rev` }).then((r) => r.data);
    await con.put({
      path: `/${bottomid}`,
      data: { change1: 'isdone' },
      headers,
    });
    await Promise.delay(500); // give it a second to update the parent
    const newtoprev = await con
      .get({ path: `/${topid}/_rev` })
      .then((r) => r.data);
    expect(newtoprev).to.equal(toprev + 1);
  });

  it('Should set _rev to 0 on parent when child resource is deleted', async function () {
    this.timeout(5000);
    await con.delete({ path: `/${bottomid}` });
    await Promise.delay(500); // give it a second to update the parent
    const middle = await con.get({ path: `/${middleid}` }).then((r) => r.data);
    expect(middle.bottom._rev).to.deep.equal(0);
  });

  it('Should not have infinite recursion when a deep loop is present', async () => {
    await con.put({
      path: `/${bottomid}`,
      data: { middle: { _id: middleid, _rev: 0 } },
    }); // cycle middle -> bottom -> middle -> bottom -> ...
    // Write again to bottom just for good measure
    await con.put({ path: `/${bottomid}`, data: { change2: 'isdone' } });
    Promise.delay(500);
    const newmiddlerev = await con
      .get({ path: `/${middleid}/_rev` })
      .then((r) => r.data);
    expect(newmiddlerev).to.equal(3);
  });
});

async function buildTree() {
  try {
    await con.put({ path: `/${bottomid}`, data: { iam: 'bottom' }, headers });
    await con.put({
      path: `/${middleid}`,
      data: { iam: 'middle', bottom: { _id: bottomid, _rev: 0 } },
      headers,
    });
    await con.put({
      path: `/${topid}`,
      data: { iam: 'top', middle: { _id: middleid, _rev: 0 } },
      headers,
    });
  } catch (e) {
    console.log('FAILED TO BUILD TREE.  ERROR = ', e);
    throw e;
  }
}

async function cleanup() {
  await Promise.each([topid, middleid, bottomid], async (id) => {
    await con
      .get({ path: `/${id}` })
      .then(async () => con.delete({ path: `/${id}` })) // delete it
      .catch((e) => {}); // do nothing, didn't exist
  });
}
