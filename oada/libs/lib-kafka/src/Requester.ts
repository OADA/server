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

import EventEmitter from 'node:events';

import {
  Base,
  CANCEL_KEY,
  CONNECT,
  ConstructorOpts as ConstructorOptions,
  DATA,
  KafkaBase,
  REQ_ID_KEY,
  topicTimeout,
} from './base.js';

import Bluebird from 'bluebird';
import ksuid from 'ksuid';

export { ConstructorOptions as ConstructorOpts };
export class Requester extends Base {
  private timeouts: Record<string, number>;
  protected requests: Map<
    string,
    (error: Error | null, res: KafkaBase) => void
  > = new Map();

  constructor({
    consumeTopic,
    produceTopic,
    group,
    ...options
  }: ConstructorOptions) {
    super({ consumeTopic, produceTopic, group, ...options });

    super.on(DATA, (resp) => {
      const id = resp[REQ_ID_KEY];
      const done = id && this.requests.get(id);

      done && done(null, resp);
    });

    this.timeouts = {};
    if (this.produceTopic) {
      this.timeouts[this.produceTopic] = topicTimeout(this.produceTopic);
    }

    void this[CONNECT]();

    // Should this even be available?
    super.on(DATA, (...arguments_) => super.emit('response', ...arguments_));
  }

  // eslint-disable-next-line @typescript-eslint/ban-types
  async send(request: {}, topic?: string): Promise<KafkaBase>;
  async send(
    request: Record<string, unknown>,
    topic: string | null | undefined = this.produceTopic
  ): Promise<KafkaBase> {
    if (!topic) {
      throw new Error('Send called with no topic specified');
    }

    const id = (request[REQ_ID_KEY] || ksuid.randomSync().string) as string;
    const timeout = this.timeouts[topic] ?? topicTimeout(topic);
    this.timeouts[topic] = timeout;

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
    topic: string | null | undefined = this.produceTopic
  ): Promise<EventEmitter & { close(): Promise<void> }> {
    if (!topic) {
      throw new Error('Emit called with no topic specified');
    }

    const emitter = new EventEmitter();

    const id = request[REQ_ID_KEY] || ksuid.randomSync().string;

    request[REQ_ID_KEY] = id;
    // TODO: Handle partitions?
    request.resp_partition = 0;

    this.requests.set(id, (_e, res) => emitter.emit('response', res));
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

    return { ...emitter, close };
  }
}
