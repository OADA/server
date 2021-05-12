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

import type EventEmitter from 'events';
import { Base, CONNECT, DATA, KafkaBase } from './base';
import {
  Responder,
  Response,
  ConstructorOpts as ResponderOpts,
} from './Responder';
import { Requester, ConstructorOpts as RequesterOpts } from './Requester';
import debug from 'debug';

const trace = debug('@oada/lib-kafka:trace');

export { EventEmitter };

class DummyResponder extends Responder {
  async [CONNECT]() {
    // Don't connect to Kafka
    return undefined;
  }
}
class DummyRequester extends Requester {
  async [CONNECT]() {
    // Don't connect to Kafka
    return undefined;
  }
}

export type ConstructorOpts = Omit<
  ResponderOpts & RequesterOpts,
  'consumeTopic' | 'produceTopic'
> & {
  respondOwn?: boolean;
  requestTopics: { consumeTopic: string; produceTopic: string };
  respondTopics: { consumeTopic: string; produceTopic: string };
};
// Class for when responding to reuqests requires making other requests
// TODO: Better class name?
export class ResponderRequester extends Base {
  private responder: DummyResponder;
  private requester: DummyRequester;
  private respondOwn;

  constructor({
    requestTopics,
    respondTopics,
    group,
    respondOwn = false,
    ...opts
  }: ConstructorOpts) {
    super({
      consumeTopic: [requestTopics.consumeTopic, respondTopics.consumeTopic],
      group,
      ...opts,
    });

    this.respondOwn = respondOwn;

    // Make a Responder and Requester using our consumer/producer
    this.responder = new DummyResponder({
      consumer: this.consumer,
      producer: this.producer,
      group,
      ...respondTopics,
      ...opts,
    });
    this.requester = new DummyRequester({
      consumer: this.consumer,
      producer: this.producer,
      group,
      ...requestTopics,
      ...opts,
    });

    // Mux the consumer between requester and responder
    this.on(DATA, (val, data, ...rest) => {
      trace('Received data: %o', val);
      if (data.topic === this.requester.consumeTopic) {
        trace('Muxing data to requester');
        this.requester.emit(DATA, val, data, ...rest);
      }
      if (data.topic === this.responder.consumeTopic) {
        if (!this.respondOwn && val.group === this.group) {
          // Don't respond to own requests
          return;
        }
        trace('Muxing data to responder');
        this.responder.emit(DATA, val, data, ...rest);
      }
    });

    this[CONNECT]();
  }

  /**
   * @todo Maybe rearrange type parameters? Maybe make them class params?
   */
  on<Res, Req = KafkaBase>(
    event: 'request',
    listener: (reg: Req & KafkaBase) => Response<Res> | Promise<Response<Res>>
  ): this;
  on(event: string | symbol, listener: (...args: any[]) => unknown): this;
  on(event: string | symbol, listener: (...args: any[]) => unknown): this {
    switch (event) {
      case 'ready':
        super.on('ready', listener);
        break;
      case DATA:
        super.on(DATA, listener);
        break;
      default:
        this.requester.on(event, listener);
        this.responder.on(event, listener);
        break;
    }
    return this;
  }

  // TODO: Is it better to just extend Requester?
  send(...args: Parameters<Requester['send']>) {
    return this.requester.send(...args);
  }
  async emitter(...args: Parameters<Requester['emitter']>) {
    return await this.requester.emitter(...args);
  }
}
