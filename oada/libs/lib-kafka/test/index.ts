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

import Bluebird, { TimeoutError } from 'bluebird';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { Consumer, Kafka, Producer } from 'kafkajs';
import { v4 as uuid } from 'uuid';
import debug from 'debug';

import config from '../src/config';

import { Responder } from '../src/Responder';
import { Requester } from '../src/Requester';
import type { KafkaBase } from '../src/base';
const { expect } = chai;

chai.use(chaiAsPromised);

const info = debug('@oada/lib-kafka:tests:info');
const error = debug('@oada/lib-kafka:tests:error');

const REQ_TOPIC = 'test_requests';
const RES_TOPIC = 'test_responses';
const GROUP = 'test_group';

const kafka = new Kafka({ brokers: config.get('kafka.broker') });

describe('@oada/lib-kafka', () => {
  let production: Producer;
  before(async function makeTestProduction() {
    this.timeout(10_000);

    production = kafka.producer({});

    await production.connect();
  });

  after(async function killTestProduction() {
    this.timeout(60_000);
    await production.disconnect();
  });

  let cons: Consumer;
  before(async function makeTestCons() {
    this.timeout(10_000);

    cons = kafka.consumer({
      groupId: GROUP,
    });

    await cons.connect();
  });

  after(async function killTestCons() {
    this.timeout(10_000);
    await cons.disconnect();
  });

  describe('Responder', () => {
    before(async function consumerResponses() {
      await cons.stop();
      await cons.subscribe({ topic: RES_TOPIC });
      // Cons.consume();
    });

    let res: Responder;
    beforeEach(async function createResponder() {
      info('start create responder');
      const group = `${GROUP}_${uuid()}`;

      res = new Responder({
        produceTopic: REQ_TOPIC,
        consumeTopic: RES_TOPIC,
        group,
      });
      // @ts-expect-error
      await res.ready;
    });

    afterEach(async function destroyResponder() {
      try {
        info('start destroy responder');
        await res.disconnect();
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
        res.on('request', (request_) => {
          info('request');
          done(null, request_);
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

      const reqs: KafkaBase[] = [];
      const p = Bluebird.fromCallback<KafkaBase[]>((done) => {
        res.on('request', (request) => {
          info('request');
          reqs.push(request);

          if (request.connection_id === id2) {
            done(null, reqs);
          }
        });
      }).each((request) => {
        // Make sure we didn't recieve the "old" request
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

    it('should respond to a request', () => {
      info('start');
      const id = 'DEADBEEF';
      const object = { foo: 'bar', connection_id: id };
      const value = JSON.stringify(object);

      res.on('ready', () => {
        info('ready');
      });

      const robj = { a: 'c' };
      res.on('request', (request) => {
        info('request');
        return Object.assign(request, robj);
      });

      const resp = Bluebird.fromCallback<KafkaBase>((done) => {
        cons.run({
          eachMessage: async ({ message: { value } }) => {
            // Assume all messages are JSON
            const resp = value && JSON.parse(value.toString());

            if (resp.connection_id === id) {
              done(null, resp);
            }
          },
        });
      }).then((resp) => {
        // @ts-expect-error
        delete resp.time;
        return resp;
      });

      production.send({ topic: REQ_TOPIC, messages: [{ value }] });
      return expect(resp).to.eventually.deep.equal(Object.assign(object, robj));
    });
  });

  describe('Requester', () => {
    before(async function consumerRequests() {
      await cons.stop();
      await cons.subscribe({ topic: REQ_TOPIC });
      // Cons.consume();
    });

    let request: Requester;
    beforeEach(function createRequester(done) {
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

    afterEach(function destroyRequester(done) {
      info('start destroy requester');
      request.disconnect().finally(() => {
        info('finish destroy requester');
        done();
      });
    });

    it('should make a request', () => {
      const id = uuid();
      const object: KafkaBase = { connection_id: id, msgtype: 'test' };

      const resp = Bluebird.fromCallback<KafkaBase>((done) => {
        cons.run({
          eachMessage: async ({ message: { value } }) => {
            // Assume all messages are JSON
            const resp = value && JSON.parse(value.toString());

            if (resp.connection_id === id) {
              done(null, resp);
            }
          },
        });
      }).then(async (resp) => {
        const value = JSON.stringify(resp);
        await production.send({ topic: RES_TOPIC, messages: [{ value }] });
      });

      request.send(object).catch(() => {}); // Ignore response
      return resp;
    });

    it('should receive a response', async () => {
      const id = uuid();
      const object: KafkaBase = { connection_id: id, msgtype: 'test' };

      const resp = Bluebird.fromCallback<KafkaBase>((done) => {
        cons.run({
          eachMessage: async ({ message: { value } }) => {
            // Assume all messages are JSON
            const resp = value && JSON.parse(value.toString());

            if (resp.connection_id === id) {
              done(null, resp);
            }
          },
        });
      }).then(async (resp) => {
        const value = JSON.stringify(resp);
        await production.send({ topic: RES_TOPIC, messages: [{ value }] });
      });

      return Promise.all([request.send(object), resp]);
    });

    it('should timeout when no response', function () {
      this.timeout(10_000);
      const id = uuid();
      const object: KafkaBase = { connection_id: id, msgtype: 'test' };

      return expect(request.send(object)).to.be.rejectedWith(TimeoutError);
    });
  });
});
