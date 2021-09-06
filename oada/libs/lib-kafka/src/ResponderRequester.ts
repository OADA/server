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

import { Base, CONNECT, DATA, KafkaBase } from './base';
import { ConstructorOpts as RequesterOpts, Requester } from './Requester';
import {
  ConstructorOpts as ResponderOpts,
  Responder,
  Response,
} from './Responder';

import type Bluebird from 'bluebird';
import debug from 'debug';
import type EventEmitter from 'events';
import type { EachMessagePayload } from 'kafkajs';

const trace = debug('@oada/lib-kafka:trace');

export { EventEmitter };

class DummyResponder extends Responder {
  constructor(opts: ResponderOpts, ready: Bluebird<void>) {
    super(opts);
    this.ready = ready;
  }
  override [CONNECT](): Promise<void> {
    // Don't connect to Kafka
    return Promise.resolve();
  }
}
class DummyRequester extends Requester {
  constructor(opts: RequesterOpts, ready: Bluebird<void>) {
    super(opts);
    this.ready = ready;
  }
  override [CONNECT](): Promise<void> {
    // Don't connect to Kafka
    return Promise.resolve();
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
    this.responder = new DummyResponder(
      {
        consumer: this.consumer,
        producer: this.producer,
        group,
        ...respondTopics,
        ...opts,
      },
      this.ready
    );
    this.requester = new DummyRequester(
      {
        consumer: this.consumer,
        producer: this.producer,
        group,
        ...requestTopics,
        ...opts,
      },
      this.ready
    );

    // Mux the consumer between requester and responder
    this.on(DATA, (val: KafkaBase, data, ...rest) => {
      trace(data, 'Received data: %o', val);
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

    void this[CONNECT]();
  }

  /**
   * @todo Maybe rearrange type parameters? Maybe make them class params?
   */
  override on<Res, Req = KafkaBase>(
    event: 'request',
    listener: (reg: Req & KafkaBase) => Response<Res> | Promise<Response<Res>>
  ): this;
  override on(
    event: typeof DATA,
    listener: (
      resp: any,
      payload: EachMessagePayload,
      ...rest: any[]
    ) => unknown
  ): this;
  override on(
    event: string | symbol,
    listener: (...args: any[]) => unknown
  ): this;
  override on(
    event: string | symbol,
    listener: (...args: any[]) => unknown
  ): this {
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
  send(...args: Parameters<Requester['send']>): Promise<KafkaBase> {
    return this.requester.send(...args);
  }
  async emitter(...args: Parameters<Requester['emitter']>) {
    return await this.requester.emitter(...args);
  }
}