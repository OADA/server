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
const trace = debug('trace:write-handler#test');

// DO NOT include ../ because we are testing externally.  Including here will cause admin copy of it
// to receive some of the kafka responses.

const oada = require('@oada/client');

const headers = { 'content-type': 'application/json' };
const topid = `resources/WRITEHANDLERTEST_TOP1`;
const middleid = `resources/WRITEHANDLERTEST_MIDDLE1`;
const bottomid = `resources/WRITEHANDLERTEST_BOTTOM1`;

let con = false;
describe('External tests of write-handler, run from admin', () => {
  before(async () => {
    con = await oada.connect({ domain: 'proxy', token: 'god-proxy' });
  });

  beforeEach(async () => {
    await cleanup();
    await buildTree();
  });

  //    after(async () => cleanup());

  it('Should include the link key in the change document when deleting a link to a non-existent resource', async function () {
    this.timeout(2000);
    await con.put({
      path: `/${topid}`,
      data: { nonexistentlink: { _id: 'resources/DOESNOTEXIST', _rev: 0 } },
      headers,
    });
    const firstrev = await con
      .get({ path: `/${topid}/_rev` })
      .then((r) => r.data);
    await con
      .delete({ path: `/${topid}/nonexistentlink` })
      .catch((e) => trace('FAILED DELETE: e = ', e));
    const changedocs = await con
      .get({ path: `/${topid}/_meta/_changes/${firstrev + 1}` })
      .then((r) => r.data)
      .catch((e) => trace('FAILED GET CHANGE DOC, e = ', e));
    const thechange = _.find(changedocs, (c) => c.type === 'delete');

    expect(_.get(thechange, 'type')).to.equal('delete');
    expect(_.has(thechange, 'body.nonexistentlink')).to.equal(true);
    expect(_.get(thechange, 'body.nonexistentlink')).to.equal(null);
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
