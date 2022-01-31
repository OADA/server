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

import config from '../dist/config.js';

import EventEmitter, { once } from 'node:events';

import test from 'ava';

import { Consumer, Kafka, Producer } from 'kafkajs';
import { v4 as uuid } from 'uuid';

import Bluebird from 'bluebird';
import type { KafkaBase } from '../src/base.js';
import { Requester } from '../dist/Requester.js';

const REQ_TOPIC = 'test_requests';
const RES_TOPIC = 'test_responses';
const GROUP = 'test_group';

const kafka = new Kafka({ brokers: config.get('kafka.broker') });

let producer: Producer;
test.before(async (t) => {
  t.timeout(10_000);

  producer = kafka.producer({});

  await producer.connect();
});

test.after(async (t) => {
  t.timeout(60_000);
  await producer.disconnect();
});

let cons: Consumer;
test.before(async (t) => {
  t.timeout(10_000);

  cons = kafka.consumer({
    groupId: GROUP,
  });

  await cons.connect();
});

test.after(async (t) => {
  t.timeout(10_000);
  await cons.disconnect();
});

test.before(async () => {
  await cons.stop();
  await cons.subscribe({ topic: REQ_TOPIC });
  // Cons.consume();
});

let request: Requester;
test.beforeEach(async () => {
  const group = `${GROUP}_${uuid()}`;

  request = new Requester({
    consumeTopic: RES_TOPIC,
    produceTopic: REQ_TOPIC,
    group,
  });

  await once(request, 'ready');
});

test.afterEach(async () => {
  await request.disconnect();
});

test('should make a request', async () => {
  const id = uuid();
  const object: KafkaBase = { connection_id: id, msgtype: 'test' };

  const emitter = new EventEmitter();
  await cons.run({
    eachMessage: async ({ message: { value } }) => {
      // Assume all messages are JSON
      const v: unknown = value && JSON.parse(value.toString());
      emitter.emit('message', v);

      // @ts-expect-error stupid errors
      if (v.connection_id === id) {
        emitter.emit('message', v);
      }
    },
  });

  const message = once(emitter, 'message');
  try {
    await request.send(object);
  } catch {
    // Ignore response
  }

  const [resp] = (await message) as unknown[];
  const value = JSON.stringify(resp);
  await producer.send({ topic: RES_TOPIC, messages: [{ value }] });

  return resp;
});

test('should receive a response', async () => {
  const id = uuid();
  const object: KafkaBase = { connection_id: id, msgtype: 'test' };

  const emitter = new EventEmitter();
  await cons.run({
    eachMessage: async ({ message: { value } }) => {
      // Assume all messages are JSON
      const v: unknown = value && JSON.parse(value.toString());

      // @ts-expect-error stupid errors
      if (v.connection_id === id) {
        emitter.emit('message', v);
      }
    },
  });

  const message = once(emitter, 'message');
  try {
    await request.send(object);
  } catch {
    // Ignore response
  }

  const [resp] = (await message) as unknown[];
  const value = JSON.stringify(resp);
  await producer.send({ topic: RES_TOPIC, messages: [{ value }] });

  return resp;
});

test('should timeout when no response', async (t) => {
  t.timeout(10_000);

  const id = uuid();
  const object: KafkaBase = { connection_id: id, msgtype: 'test' };

  await t.throwsAsync(request.send(object), {
    instanceOf: Bluebird.TimeoutError,
  });
});
