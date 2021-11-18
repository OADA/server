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

/* eslint-disable sonarjs/no-identical-functions */
/* eslint-disable max-nested-callbacks */

import type {} from 'mocha';

import Bluebird, { TimeoutError } from 'bluebird';
import { Consumer, Kafka, Producer } from 'kafkajs';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import debug from 'debug';
import { v4 as uuid } from 'uuid';

import config from '../src/config';

import type { KafkaBase } from '../src/base';
import { Requester } from '../src/Requester';
import { Responder } from '../src/Responder';

chai.use(chaiAsPromised);

const info = debug('@oada/lib-kafka:tests:info');
const error = debug('@oada/lib-kafka:tests:error');

const REQ_TOPIC = 'test_requests';
const RES_TOPIC = 'test_responses';
const GROUP = 'test_group';

const kafka = new Kafka({ brokers: config.get('kafka.broker') });

describe('@oada/lib-kafka', () => {
  let production: Producer;
  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-invalid-this
    this.timeout(10_000);

    production = kafka.producer({});

    await production.connect();
  });

  after(async function () {
    // eslint-disable-next-line @typescript-eslint/no-invalid-this
    this.timeout(60_000);
    await production.disconnect();
  });

  let cons: Consumer;
  before(async function () {
    // eslint-disable-next-line @typescript-eslint/no-invalid-this
    this.timeout(10_000);

    cons = kafka.consumer({
      groupId: GROUP,
    });

    await cons.connect();
  });

  after(async function () {
    // eslint-disable-next-line @typescript-eslint/no-invalid-this
    this.timeout(10_000);
    await cons.disconnect();
  });

  describe('Responder', () => {
    before(async () => {
      await cons.stop();
      await cons.subscribe({ topic: RES_TOPIC });
      // Cons.consume();
    });

    let responder: Responder;
    beforeEach(async () => {
      info('start create responder');
      const group = `${GROUP}_${uuid()}`;

      responder = new Responder({
        produceTopic: REQ_TOPIC,
        consumeTopic: RES_TOPIC,
        group,
      });
      // @ts-expect-error cheating
      await responder.ready;
    });

    afterEach(async () => {
      try {
        info('start destroy responder');
        await responder.disconnect();
      } finally {
        info('finish destroy responder');
      }
    });

    it('should receive a request', async () => {
      info('start');
      const object = {
        connection_id: uuid(),
        foo: 'baz',
        time: Date.now(),
      };
      const value = JSON.stringify(object);

      const request = Bluebird.fromCallback((done) => {
        responder.on('request', (r) => {
          info('request');
          // eslint-disable-next-line unicorn/no-null
          done(null, r);
        });
      });

      await production.send({ topic: REQ_TOPIC, messages: [{ value }] });
      await expect(request).to.eventually.deep.equal(object);
    });

    it('should not receive timed-out requests', async () => {
      info('start');
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

      const requests: KafkaBase[] = [];
      const p = Bluebird.fromCallback<KafkaBase[]>((done) => {
        responder.on('request', (request) => {
          info('request');
          requests.push(request);

          if (request.connection_id === id2) {
            // eslint-disable-next-line unicorn/no-null
            done(null, requests);
          }
        });
      }).each((request) => {
        // Make sure we didn't receive the "old" request
        expect(request.connection_id).to.not.equal(id1);
      });

      await production.send({
        topic: REQ_TOPIC,
        messages: [{ value: value1 }],
      });
      await production.send({
        topic: REQ_TOPIC,
        messages: [{ value: value2 }],
      });

      return p;
    });

    it('should respond to a request', async () => {
      info('start');
      const id = 'DEADBEEF';
      const object = { foo: 'bar', connection_id: id };
      const value = JSON.stringify(object);

      responder.on('ready', () => {
        info('ready');
      });

      const rObject = { a: 'c' };
      responder.on('request', (request) => {
        info('request');
        return Object.assign(request, rObject);
      });

      const { time, ...resp } = await Bluebird.fromCallback<KafkaBase>(
        (done) => {
          void cons.run({
            // eslint-disable-next-line @typescript-eslint/no-shadow
            eachMessage: async ({ message: { value } }) => {
              // Assume all messages are JSON
              const v: unknown = value && JSON.parse(value.toString());

              // @ts-expect-error stupid errors
              if (v.connection_id === id) {
                // eslint-disable-next-line unicorn/no-null
                done(null, v);
              }
            },
          });
        }
      );

      await production.send({ topic: REQ_TOPIC, messages: [{ value }] });
      return expect(resp).to.eventually.deep.equal(
        Object.assign(object, rObject)
      );
    });
  });

  describe('Requester', () => {
    before(async () => {
      await cons.stop();
      await cons.subscribe({ topic: REQ_TOPIC });
      // Cons.consume();
    });

    let request: Requester;
    beforeEach((done) => {
      info('start create requester');
      const group = `${GROUP}_${uuid()}`;

      request = new Requester({
        consumeTopic: RES_TOPIC,
        produceTopic: REQ_TOPIC,
        group,
      });
      request.on('error', error);
      request.on('ready', () => {
        info('finish create requester');
        done();
      });
    });

    afterEach(async () => {
      info('start destroy requester');
      try {
        await request.disconnect();
      } finally {
        info('finished destroy requester');
      }
    });

    it('should make a request', async () => {
      const id = uuid();
      const object: KafkaBase = { connection_id: id, msgtype: 'test' };

      const resp = await Bluebird.fromCallback<KafkaBase>((done) => {
        void cons.run({
          eachMessage: async ({ message: { value } }) => {
            // Assume all messages are JSON
            const v: unknown = value && JSON.parse(value.toString());

            // @ts-expect-error stupid errors
            if (v.connection_id === id) {
              // eslint-disable-next-line unicorn/no-null
              done(null, v);
            }
          },
        });
      });
      const value = JSON.stringify(resp);
      await production.send({ topic: RES_TOPIC, messages: [{ value }] });

      try {
        await request.send(object);
      } catch {
        // Ignore response
      }

      return resp;
    });

    it('should receive a response', async () => {
      const id = uuid();
      const object: KafkaBase = { connection_id: id, msgtype: 'test' };

      const resp = await Bluebird.fromCallback<KafkaBase>((done) => {
        void cons.run({
          eachMessage: async ({ message: { value } }) => {
            // Assume all messages are JSON
            const v: unknown = value && JSON.parse(value.toString());

            // @ts-expect-error stupid errors
            if (v.connection_id === id) {
              // eslint-disable-next-line unicorn/no-null
              done(null, v);
            }
          },
        });
      });
      const value = JSON.stringify(resp);
      await production.send({ topic: RES_TOPIC, messages: [{ value }] });

      return Promise.all([request.send(object), resp]);
    });

    it('should timeout when no response', function () {
      // eslint-disable-next-line @typescript-eslint/no-invalid-this
      this.timeout(10_000);
      const id = uuid();
      const object: KafkaBase = { connection_id: id, msgtype: 'test' };

      return expect(request.send(object)).to.be.rejectedWith(TimeoutError);
    });
  });
});
