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

import { once } from 'node:events';

import test from 'ava';

import randomstring from 'randomstring';

import config from '../dist/config.js';

import { Requester } from '@oada/lib-kafka';
import type { WriteRequest } from '@oada/write-handler';
import { init } from '@oada/lib-arangodb';

import { stopResp } from '../';

const { httpResponse, writeResponse } = config.get('kafka.topics');
const requester = new Requester({
  consumeTopic: httpResponse,
  produceTopic: writeResponse,
  group: 'rev-graph-update-test',
});

test.before(init.run);
test.before(async () => {
  await once(requester, 'ready');
});

// --------------------------------------------------
// The tests!
// --------------------------------------------------
test('should be able to produce a correct write_request message', async (t) => {
  t.timeout(10_000);
  // Make http_response message
  const r = {
    msgtype: 'write-response',
    code: 'success',
    resource_id: '/resources:default:resources_rock_123',
    connection_id: `123abc${randomstring.generate(7)}`,
    _rev: randomstring.generate(7),
    doc: {
      user_id: `franko123${randomstring.generate(7)}`,
    },
    authorizationid: `tuco123${randomstring.generate(7)}`,
  };

  t.log(r, 'http_response message');

  // Now produce the message:
  // create the listener:

  const message = (await requester.send(r)) as WriteRequest;
  t.log(message, 'received message');
  // @ts-expect-error nonsense
  t.is(message.type, 'write_request');
  t.is(message.path_leftover, '/rocks-index/90j2klfdjss/_rev');
  t.is(message.resource_id, 'resources/default:resources_rocks_123');
  t.is(message.contentType, 'application/vnd.oada.rocks.1+json');
  t.is(message.user_id, r.doc.user_id);
  t.is(message.authorizationid, r.authorizationid);
  t.is(message.body, r._rev);
  // @ts-expect-error nonsense
  t.is(message.connection_id, r.connection_id);
  // @ts-expect-error nonsense
  t.is(message.url, '');
});

// -------------------------------------------------------
// After tests are done, get rid of our temp database
// -------------------------------------------------------
test.after(init.cleanup);
test.after(async (t) => {
  t.timeout(10_000);
  await requester.disconnect();
});
test.after(async (t) => {
  t.timeout(10_000);
  await stopResp();
});
