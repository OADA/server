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

import _ from 'lodash';
import { expect } from 'chai';
import Bluebird from 'bluebird';
import debug from 'debug';

// DO NOT include ../ because we are testing externally.  Including here will cause admin copy of it
// to receive some of the kafka responses.

import { Change, OADAClient, connect } from '@oada/client';

const trace = debug('trace:write-handler#test');

const topid = `resources/WRITEHANDLERTEST_TOP1`;
const middleid = `resources/WRITEHANDLERTEST_MIDDLE1`;
const bottomid = `resources/WRITEHANDLERTEST_BOTTOM1`;

let con: OADAClient;
describe('External tests of write-handler, run from admin', () => {
  before(async () => {
    con = await connect({ domain: 'proxy', token: 'god-proxy' });
  });

  beforeEach(async () => {
    await cleanup();
    await buildTree();
  });

  //    After(async () => cleanup());

  it('Should include the link key in the change document when deleting a link to a non-existent resource', async function () {
    this.timeout(2000);
    await con.put({
      path: `/${topid}`,
      data: { nonexistentlink: { _id: 'resources/DOESNOTEXIST', _rev: 0 } },
      contentType: 'application/json',
    });
    const firstrev = (await con
      .get({ path: `/${topid}/_rev` })
      .then((r) => r.data)) as number;
    await con.delete({ path: `/${topid}/nonexistentlink` }).catch((error) => {
      trace('FAILED DELETE: e = ', error);
    });
    const changedocs = (await con
      .get({ path: `/${topid}/_meta/_changes/${firstrev + 1}` })
      .then((r) => r.data)
      .catch((error) => {
        trace('FAILED GET CHANGE DOC, e = ', error);
      })) as unknown as Change[];
    const thechange = _.find(changedocs, (c) => c.type === 'delete');

    expect(_.get(thechange, 'type')).to.equal('delete');
    expect(_.has(thechange, 'body.nonexistentlink')).to.equal(true);
    expect(_.get(thechange, 'body.nonexistentlink')).to.equal(null);
  });
});

async function buildTree() {
  try {
    await con.put({
      path: `/${bottomid}`,
      data: { iam: 'bottom' },
      contentType: 'application/json',
    });
    await con.put({
      path: `/${middleid}`,
      data: { iam: 'middle', bottom: { _id: bottomid, _rev: 0 } },
      contentType: 'application/json',
    });
    await con.put({
      path: `/${topid}`,
      data: { iam: 'top', middle: { _id: middleid, _rev: 0 } },
      contentType: 'application/json',
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
