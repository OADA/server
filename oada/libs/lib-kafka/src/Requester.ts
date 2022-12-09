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
import { setTimeout } from 'node:timers/promises';

import { EventEmitter } from 'eventemitter3';
import ksuid from 'ksuid';

import {
  Base,
  CANCEL_KEY,
  type ConstructorOptions,
  DATA,
  type KafkaBase,
  REQ_ID_KEY,
  topicTimeout,
} from './Base.js';

export class KafkaRequestTimeoutError extends Error {}

export class Requester extends Base {
  #timeouts = new Map<string, number>();

  constructor({
    consumeTopic,
    produceTopic,
    group,
    ...options
  }: ConstructorOptions) {
    super({ consumeTopic, produceTopic, group, ...options });

    super.on(DATA, (resp) => {
      // eslint-disable-next-line security/detect-object-injection
      const id = resp[REQ_ID_KEY];
      this.emit(`response-${id}`, resp);
    });

    if (this.produceTopic) {
      this.#timeouts.set(this.produceTopic, topicTimeout(this.produceTopic));
    }

    void this.connect();

    // Should this even be available?
    super.on(DATA, (...rest) => super.emit('response', ...rest));
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  async send(request: {}, topic?: string): Promise<KafkaBase>;
  async send(
    request: Record<string, unknown>,
    // eslint-disable-next-line @typescript-eslint/ban-types
    topic: string | null | undefined = this.produceTopic
  ): Promise<KafkaBase> {
    if (!topic) {
      throw new Error('Send called with no topic specified');
    }

    // eslint-disable-next-line security/detect-object-injection
    const id = (request[REQ_ID_KEY] || ksuid.randomSync().string) as string;
    const timeout = this.#timeouts.get(topic) ?? topicTimeout(topic);
    this.#timeouts.set(topic, timeout);

    const requestDone = once(this, `response-${id}`) as Promise<[KafkaBase]>;
    // TODO: Handle partitions?
    await this.produce({
      mesg: { ...request, [REQ_ID_KEY]: id, resp_partition: '0' },
      topic,
      part: null,
    });
    const [response] = await Promise.race([
      requestDone,
      this.#timeout(timeout, `${topic} timeout`),
    ]);
    return response;
  }

  /**
   * Like send but return an event emitter to allow multiple responses
   */
  async emitter(
    request: KafkaBase,
    // eslint-disable-next-line @typescript-eslint/ban-types
    topic: string | null | undefined = this.produceTopic
  ): Promise<EventEmitter & { close(): Promise<void> }> {
    if (!topic) {
      throw new Error('Emit called with no topic specified');
    }

    const emitter = new EventEmitter();

    // eslint-disable-next-line security/detect-object-injection
    const id = request[REQ_ID_KEY] ?? (await ksuid.random()).string;

    // eslint-disable-next-line security/detect-object-injection
    request[REQ_ID_KEY] = id;
    // TODO: Handle partitions?
    request.resp_partition = 0;

    this.on(`response-${id}`, (response) => emitter.emit('response', response));
    const close = async () => {
      // Send cancel message to other end
      const mesg = {
        [REQ_ID_KEY]: id,
        [CANCEL_KEY]: true,
      };

      await this.produce({ mesg, topic, part: null });
    };

    await this.produce({
      mesg: request as Record<string, unknown>,
      topic,
      part: null,
    });

    // @ts-expect-error adsadds
    return { close, ...emitter };
  }

  async #timeout(timeout: number, message?: string): Promise<never> {
    await setTimeout(timeout);
    throw new KafkaRequestTimeoutError(message ?? 'timeout');
  }
}

export type { ConstructorOptions } from './Base.js';
