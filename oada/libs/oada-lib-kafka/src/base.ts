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
 * limitations under the License.
 */

import process from 'process';
import EventEmitter from 'events';

import Bluebird from 'bluebird';
import { Kafka, Producer, Consumer, logLevel, EachMessagePayload } from 'kafkajs';
import debug from 'debug';

import config from './config';

//const info = debug('@oada/lib-kafka:info');
const error = debug('@oada/lib-kafka:error');

const REQ_ID_KEY = 'connection_id';
const CANCEL_KEY = 'cancel_request';

const CONNECT = Symbol('kafka-lib-connect');
const DATA = Symbol('kafa-lib-data');

function topicTimeout(topic: string) {
  let timeout = config.get('kafka.timeouts.default');

  const topics = config.get('kafka.topics');
  Object.keys(topics).forEach((topick) => {
    if (topics[topick] === topic) {
      timeout = config.get('kafka.timeouts')[topick] || timeout;
    }
  });

  return timeout;
}

// Make it die on unhandled error
// TODO: Figure out what is keeping node from dying on unhandled exception?
function die(err: Error) {
  error('Unhandled error: %O', err);
  process.abort();
}

export interface ConstructorOpts {
  consumeTopic: string | string[];
  produceTopic?: string | null;
  group: string;
  /**
   * @todo Document these opts
   */
  opts?: { [key: string]: any };
  /** @internal */
  producer?: Producer;
  /** @internal */
  consumer?: Consumer;
}

/**
 * Base interface for kafka messages (either request or response)
 */
export interface KafkaBase {
  connection_id?: string;
  msgtype?: string;
  code?: string;
  /**
   * @todo implement multiple paritions
   */
  resp_partition?: 0;
}

/**
 * Make kafkajs logging nicer?
 */
type KafkajsDebug = Record<
  keyof Omit<typeof logLevel, 'NOTHING'>,
  debug.Debugger
>;
const kafkajsDebugs: Record<string, KafkajsDebug> = {};
function getKafkajsDebug(namespace: string): KafkajsDebug {
  return (
    kafkajsDebugs[namespace] ??
    (kafkajsDebugs[namespace] = {
      ERROR: debug(`kafkajs:${namespace}:error`),
      WARN: debug(`kafkajs:${namespace}:warn`),
      INFO: debug(`kafkajs:${namespace}:info`),
      DEBUG: debug(`kafkajs:${namespace}:debug`),
    })
  );
}

export class Base extends EventEmitter {
  readonly consumeTopic;
  readonly produceTopic;
  readonly group;
  private kafka: Kafka;
  protected consumer;
  protected producer;
  protected ready: Bluebird<void>;
  #done!: (err?: Error) => void;

  constructor({
    consumeTopic,
    consumer,
    produceTopic,
    producer,
    group,
  }: ConstructorOpts) {
    super();

    this.consumeTopic = consumeTopic;
    this.produceTopic = produceTopic;
    this.group = group;

    this.kafka = new Kafka({
      /**
       * Make kafkajs logging nicer?
       */
      logCreator() {
        return ({ namespace, label, log: { message, ...extra } }) => {
          const l = label as keyof KafkajsDebug;
          const log = getKafkajsDebug(namespace)[l];
          return log(extra, message);
        };
      },
      brokers: config.get('kafka.broker'),
    });

    this.consumer =
      consumer ??
      this.kafka.consumer({
        groupId: this.group,
      });
    this.producer = producer ?? this.kafka.producer();

    // see: https://github.com/Blizzard/node-rdkafka/issues/222
    // says fixed, but seems to still be an issue for us.
    process.on('uncaughtExceptionMonitor', async () => {
      error('Disconnect kafka clients due to uncaught exception');
      // Disconnect kafka clients on uncaught exception
      try {
        await this.consumer.disconnect();
      } catch (err) {
        error(err);
      }
      try {
        await this.producer.disconnect();
      } catch (err) {
        error(err);
      }
    });

    this.ready = Bluebird.fromCallback((done) => {
      this.#done = done;
    });
  }
  async [CONNECT]() {
    try {
      await this.consumer.connect();
      await this.producer.connect();

      for (const topic of Array.isArray(this.consumeTopic)
        ? this.consumeTopic
        : [this.consumeTopic]) {
        await this.consumer.subscribe({ topic });
      }
      await this.consumer.run({
        eachMessage: async (payload) => {
          // Assume all messages are JSON
          const resp = payload.message.value &&
            JSON.parse(payload.message.value.toString());
          super.emit(DATA, resp, payload);
        },
      });
    } catch (err) {
      return this.#done(err);
    }
    this.#done();
  }

  override on(
    event: typeof DATA,
    listener: (resp: any, payload: EachMessagePayload, ...rest: any[]) => unknown
  ): this;
  override on(
    event: string | symbol,
    listener: (...args: any[]) => unknown
  ): this;
  override on(event: string | symbol, listener: (...args: any[]) => unknown) {
    if (event === 'error') {
      // Remove our default error handler?
      super.removeListener('error', die);
    }
    return super.on(event, listener);
  }

  async produce({
    mesg,
    topic,
    // @ts-ignore
    part = null,
  }: {
    mesg: {};
    topic?: string;
    part: number | null;
  }) {
    // Assume all messages are JSON
    const value = JSON.stringify({
      time: Date.now(),
      group: this.group,
      ...mesg,
    });

    return this.producer.send({
      topic: topic || this.produceTopic!,
      messages: [{ value }],
    });
  }

  async disconnect() {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }
}

export { REQ_ID_KEY, CANCEL_KEY, topicTimeout, CONNECT, DATA };
