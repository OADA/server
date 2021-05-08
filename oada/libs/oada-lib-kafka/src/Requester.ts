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

import EventEmitter from 'events';

import ksuid from 'ksuid';
import Bluebird from 'bluebird';

import {
  Base,
  topicTimeout,
  CONNECT,
  DATA,
  REQ_ID_KEY,
  CANCEL_KEY,
  ConstructorOpts,
  KafkaBase,
} from './base';

export { ConstructorOpts };
export class Requester extends Base {
  private timeouts: Record<string, number>;
  protected requests: Record<
    string,
    (err: Error | null, res: KafkaBase) => void
  > = {};

  constructor({ consumeTopic, produceTopic, group, ...opts }: ConstructorOpts) {
    super({ consumeTopic, produceTopic, group, ...opts });

    super.on(DATA, (resp) => {
      const done = this.requests[resp[REQ_ID_KEY]];

      return done && done(null, resp);
    });

    this.timeouts = {};
    if (this.produceTopic) {
      this.timeouts[this.produceTopic] = topicTimeout(this.produceTopic);
    }

    this[CONNECT]();

    // Should this even be available?
    super.on(DATA, (...args) => super.emit('response', ...args));
  }

  async send(request: KafkaBase, topic: string = this.produceTopic!) {
    const id = request[REQ_ID_KEY] || ksuid.randomSync().string;
    const timeout = this.timeouts[topic] ?? topicTimeout(topic);
    this.timeouts[topic] = timeout;

    request[REQ_ID_KEY] = id;
    // TODO: Handle partitions?
    request['resp_partition'] = 0;

    const reqDone = Bluebird.fromCallback((done) => {
      this.requests[id] = done;
    });
    try {
      await this.produce({ mesg: request, topic, part: null });
      return await reqDone.timeout(timeout, topic + ' timeout');
    } finally {
      delete this.requests[id];
    }
  }

  // Like send but return an event emitter to allow multiple responses
  async emitter(request: KafkaBase, topic: string = this.produceTopic!) {
    const emitter = new EventEmitter();

    const id = request[REQ_ID_KEY] || ksuid.randomSync().string;

    request[REQ_ID_KEY] = id;
    // TODO: Handle partitions?
    request['resp_partition'] = 0;

    this.requests[id] = (_e, res) => emitter.emit('response', res);
    const close = async () => {
      try {
        // Send cancel message to other end
        const mesg = {
          [REQ_ID_KEY]: id,
          [CANCEL_KEY]: true,
        };

        await this.produce({ mesg, topic, part: null });
      } finally {
        delete this.requests[id];
      }
    };

    await this.produce({ mesg: request, topic, part: null });
    return { ...emitter, close };
  }
}
