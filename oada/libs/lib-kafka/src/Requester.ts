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

import { Base, CANCEL_KEY, DATA, REQ_ID_KEY, topicTimeout } from './base.js';
import type { ConstructorOptions, KafkaBase } from './base.js';

import Bluebird from 'bluebird';
import ksuid from 'ksuid';

export class Requester extends Base {
  #timeouts = new Map<string, number>();
  protected requests = new Map<
    string,
    (error: Error | undefined, response: KafkaBase) => void
  >();

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
      const done = id ? this.requests.get(id) : undefined;

      done?.(undefined, resp);
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

    const requestDone = Bluebird.fromCallback((done) => {
      this.requests.set(id, done);
    });
    try {
      // TODO: Handle partitions?
      await this.produce({
        mesg: { ...request, [REQ_ID_KEY]: id, resp_partition: '0' },
        topic,
        part: null,
      });
      return (await requestDone.timeout(
        timeout,
        `${topic} timeout`
      )) as KafkaBase;
    } finally {
      this.requests.delete(id);
    }
  }

  // Like send but return an event emitter to allow multiple responses
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

    this.requests.set(id, (_error, response) =>
      emitter.emit('response', response)
    );
    const close = async () => {
      try {
        // Send cancel message to other end
        const mesg = {
          [REQ_ID_KEY]: id,
          [CANCEL_KEY]: true,
        };

        await this.produce({ mesg, topic, part: null });
      } finally {
        this.requests.delete(id);
      }
    };

    await this.produce({
      mesg: request as Record<string, unknown>,
      topic,
      part: null,
    });

    // @ts-expect-error adsadds
    return { close, ...emitter };
  }
}

export type { ConstructorOptions } from './base.js';
