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

import { config } from '../dist/config.js';

import EventEmitter, { on, once } from 'node:events';

import test from 'ava';

import type { Consumer, Producer } from 'kafkajs';
import { Kafka } from 'kafkajs';
import { v4 as uuid } from 'uuid';

import type { KafkaBase } from '../src/Base.js';
import { Responder } from '../dist/Responder.js';

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

let cons: Consumer;
test.before(async (t) => {
  t.timeout(10_000);

  cons = kafka.consumer({
    groupId: GROUP,
  });

  await cons.connect();
});

test.before(async () => {
  await cons.stop();
  await cons.subscribe({ topic: RES_TOPIC });
  // Cons.consume();
});

test.after(async (t) => {
  t.timeout(60_000);
  await producer.disconnect();
});

test.after(async (t) => {
  t.timeout(10_000);
  await cons.disconnect();
});

let responder: Responder;
test.beforeEach(async (t) => {
  t.log('start create responder');
  const group = `${GROUP}_${uuid()}`;

  responder = new Responder({
    produceTopic: REQ_TOPIC,
    consumeTopic: RES_TOPIC,
    group,
  });
  // @ts-expect-error cheating
  await responder.ready;
});

test.afterEach(async (t) => {
  try {
    t.log('start destroy responder');
    await responder.disconnect();
  } finally {
    t.log('finish destroy responder');
  }
});

test('should receive a request', async (t) => {
  const object = {
    connection_id: uuid(),
    foo: 'baz',
    time: Date.now(),
  };
  const value = JSON.stringify(object);

  const request: Promise<unknown[]> = once(responder, 'request');
  await producer.send({ topic: REQ_TOPIC, messages: [{ value }] });

  const [response] = await request;
  t.deepEqual(response, object);
});

test('should not receive timed-out requests', async (t) => {
  const id1 = uuid();
  const id2 = uuid();
  const value1 = JSON.stringify({
    connection_id: id1,
    time: Date.now() - 365 * 24 * 60 * 60 * 1000, // 1 year ago
  });
  const value2 = JSON.stringify({
    connection_id: id2,
    time: Date.now(),
  });

  const requests = on(responder, 'request');

  await producer.send({
    topic: REQ_TOPIC,
    messages: [{ value: value1 }],
  });
  await producer.send({
    topic: REQ_TOPIC,
    messages: [{ value: value2 }],
  });

  for await (const request of requests) {
    t.not(request.connection_id, id1);
    if (request.connection_id === id2) {
      break;
    }
  }
});

test('should respond to a request', async (t) => {
  const id = 'DEADBEEF';
  const object = { foo: 'bar', connection_id: id };
  const value = JSON.stringify(object);

  responder.on('ready', () => {
    t.log('responder ready');
  });

  const rObject = { a: 'c' };
  responder.on('request', (request) => {
    t.log('request received');
    return Object.assign(request, rObject);
  });

  const emitter = new EventEmitter();
  await cons.run({
    async eachMessage({ message: { value } }) {
      // Assume all messages are JSON
      const v: unknown = value && JSON.parse(value.toString());
      emitter.emit('message', v);
    },
  });

  const messages: AsyncIterable<KafkaBase> = on(emitter, 'message');
  await producer.send({ topic: REQ_TOPIC, messages: [{ value }] });

  for await (const message of messages) {
    if (message.connection_id === id) {
      t.deepEqual(message, Object.assign(object, rObject));
      return;
    }
  }

  t.fail('message not received');
});
