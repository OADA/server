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

import EventEmitter from 'node:events';
import process from 'node:process';

import config from './config.js';

import {
  Consumer,
  EachMessagePayload,
  Kafka,
  Producer,
  logLevel,
} from 'kafkajs';
import Bluebird from 'bluebird';
import debug from 'debug';

// Const info = debug('@oada/lib-kafka:info');
const error = debug('@oada/lib-kafka:error');

const REQ_ID_KEY = 'connection_id';
const CANCEL_KEY = 'cancel_request';

const DATA = Symbol('kafka-lib-data');

function topicTimeout(topic: string): number {
  let timeout = config.get('kafka.timeouts.default');

  const topics = config.get('kafka.topics');
  for (const [topicK, topicV] of Object.entries(topics)) {
    if (topicV === topic) {
      // eslint-disable-next-line security/detect-object-injection
      timeout = config.get('kafka.timeouts')[topicK] ?? timeout;
    }
  }

  return timeout;
}

// Make it die on unhandled error
// TODO: Figure out what is keeping node from dying on unhandled exception?
function die(reason: Error) {
  error(reason, 'Unhandled error');
  process.abort();
}

export interface ConstructorOptions {
  consumeTopic: string | string[];
  // eslint-disable-next-line @typescript-eslint/ban-types
  produceTopic?: string | null;
  group: string;
  /**
   * @todo Document these opts
   */
  opts?: Record<string, unknown>;
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
  error_message?: string;
  /**
   * @todo implement multiple partitions
   */
  resp_partition?: 0;
  group?: string;
  time?: number;
  domain?: string;
}

/**
 * Make kafkajs logging nicer?
 */
type KafkajsDebug = Record<
  keyof Omit<typeof logLevel, 'NOTHING'>,
  debug.Debugger
>;
const kafkajsDebugs: Map<string, KafkajsDebug> = new Map();
function getKafkajsDebug(namespace: string): KafkajsDebug {
  const d = kafkajsDebugs.get(namespace);
  if (d) {
    return d;
  }

  const newDebug = {
    ERROR: debug(`kafkajs:${namespace}:error`),
    WARN: debug(`kafkajs:${namespace}:warn`),
    INFO: debug(`kafkajs:${namespace}:info`),
    DEBUG: debug(`kafkajs:${namespace}:debug`),
  };
  kafkajsDebugs.set(namespace, newDebug);
  return newDebug;
}

export class Base extends EventEmitter {
  readonly consumeTopic;
  readonly produceTopic;
  readonly group;
  readonly #kafka: Kafka;
  #done!: (error_?: unknown) => void;
  protected consumer;
  protected producer;
  protected ready: Bluebird<void>;

  constructor({
    consumeTopic,
    consumer,
    produceTopic,
    producer,
    group,
  }: ConstructorOptions) {
    super();

    this.consumeTopic = consumeTopic;
    this.produceTopic = produceTopic;
    this.group = group;

    this.#kafka = new Kafka({
      /**
       * Make kafkajs logging nicer?
       */
      logCreator() {
        return ({ namespace, label, log: { message, ...extra } }) => {
          const l = label as keyof KafkajsDebug;
          // eslint-disable-next-line security/detect-object-injection
          const log = getKafkajsDebug(namespace)[l];
          log(extra, message);
        };
      },
      brokers: config.get('kafka.broker'),
    });

    this.consumer =
      consumer ??
      this.#kafka.consumer({
        groupId: this.group,
      });
    this.producer = producer ?? this.#kafka.producer();

    // See: https://github.com/Blizzard/node-rdkafka/issues/222
    // says fixed, but seems to still be an issue for us.
    process.on('uncaughtExceptionMonitor', async () => {
      error('Disconnect kafka clients due to uncaught exception');
      // Disconnect kafka clients on uncaught exception
      try {
        await this.consumer.disconnect();
      } catch (error_: unknown) {
        error(error_);
      }

      try {
        await this.producer.disconnect();
      } catch (error_: unknown) {
        error(error_);
      }
    });

    this.ready = Bluebird.fromCallback((done) => {
      this.#done = done;
    });
  }

  override on(
    event: typeof DATA,
    listener: (
      resp: KafkaBase,
      payload: EachMessagePayload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...arguments_: any[]
    ) => unknown
  ): this;
  override on(
    event: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...arguments_: any[]) => unknown
  ): this;
  override on(
    event: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...arguments_: any[]) => unknown
  ): this {
    if (event === 'error') {
      // Remove our default error handler?
      super.removeListener('error', die);
    }

    return super.on(event, listener);
  }

  async produce({
    mesg,
    topic,
  }: // Part = null,
  {
    mesg: Record<string, unknown>;
    topic?: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    part: number | null;
  }): Promise<void> {
    // Wait for producer to be ready?
    await this.ready;

    // Assume all messages are JSON
    const value = JSON.stringify({
      time: Date.now(),
      group: this.group,
      ...mesg,
    });

    await this.producer.send({
      topic: topic ?? this.produceTopic!,
      messages: [{ value }],
    });
  }

  async disconnect(): Promise<void> {
    await this.consumer.disconnect();
    await this.producer.disconnect();
  }

  protected async connect(): Promise<void> {
    try {
      await this.consumer.connect();
      await this.producer.connect();

      for (const topic of Array.isArray(this.consumeTopic)
        ? this.consumeTopic
        : [this.consumeTopic]) {
        // eslint-disable-next-line no-await-in-loop
        await this.consumer.subscribe({ topic });
      }

      await this.consumer.run({
        eachMessage: async (payload) => {
          // Assume all messages are JSON
          const resp: unknown =
            payload.message.value &&
            JSON.parse(payload.message.value.toString());
          super.emit(DATA, resp, payload);
        },
      });
    } catch (error_: unknown) {
      this.#done(error_);
      return;
    }

    this.#done();
  }
}

export { REQ_ID_KEY, CANCEL_KEY, topicTimeout, DATA };
