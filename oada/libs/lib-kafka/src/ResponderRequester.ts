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

import { Base, CONNECT, DATA, KafkaBase } from './base.js';
import {
  Requester,
  ConstructorOptions as RequesterOptions,
} from './Requester.js';
import {
  Responder,
  ConstructorOptions as ResponderOptions,
  Response,
} from './Responder.js';

import type Bluebird from 'bluebird';
import debug from 'debug';
import type EventEmitter from 'node:events';
import type { EachMessagePayload } from 'kafkajs';

const trace = debug('@oada/lib-kafka:trace');

export { EventEmitter };

class DummyResponder extends Responder {
  constructor(options: ResponderOptions, ready: Bluebird<void>) {
    super(options);
    this.ready = ready;
  }

  override async [CONNECT](): Promise<void> {
    // Don't connect to Kafka
    return Promise.resolve();
  }
}
class DummyRequester extends Requester {
  constructor(options: RequesterOptions, ready: Bluebird<void>) {
    super(options);
    this.ready = ready;
  }

  override async [CONNECT](): Promise<void> {
    // Don't connect to Kafka
    return Promise.resolve();
  }
}

export type ConstructorOpts = Omit<
  ResponderOptions & RequesterOptions,
  'consumeTopic' | 'produceTopic'
> & {
  respondOwn?: boolean;
  requestTopics: { consumeTopic: string; produceTopic: string };
  respondTopics: { consumeTopic: string; produceTopic: string };
};
// Class for when responding to requests requires making other requests
// TODO: Better class name?
export class ResponderRequester extends Base {
  private readonly responder: DummyResponder;
  private readonly requester: DummyRequester;
  private readonly respondOwn;

  constructor({
    requestTopics,
    respondTopics,
    group,
    respondOwn = false,
    ...options
  }: ConstructorOpts) {
    super({
      consumeTopic: [requestTopics.consumeTopic, respondTopics.consumeTopic],
      group,
      ...options,
    });

    this.respondOwn = respondOwn;

    // Make a Responder and Requester using our consumer/producer
    this.responder = new DummyResponder(
      {
        consumer: this.consumer,
        producer: this.producer,
        group,
        ...respondTopics,
        ...options,
      },
      this.ready
    );
    this.requester = new DummyRequester(
      {
        consumer: this.consumer,
        producer: this.producer,
        group,
        ...requestTopics,
        ...options,
      },
      this.ready
    );

    // Mux the consumer between requester and responder
    this.on(DATA, (value: KafkaBase, data, ...rest) => {
      trace(data, 'Received data: %o', value);
      if (data.topic === this.requester.consumeTopic) {
        trace('Muxing data to requester');
        this.requester.emit(DATA, value, data, ...rest);
      }

      if (data.topic === this.responder.consumeTopic) {
        if (!this.respondOwn && value.group === this.group) {
          // Don't respond to own requests
          return;
        }

        trace('Muxing data to responder');
        this.responder.emit(DATA, value, data, ...rest);
      }
    });

    void this[CONNECT]();
  }

  /**
   * @todo Maybe rearrange type parameters? Maybe make them class params?
   */
  override on<Res, Request = KafkaBase>(
    event: 'request',
    listener: (
      reg: Request & KafkaBase
    ) => Response<Res> | Promise<Response<Res>>
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
    listener: (...arguments_: any[]) => unknown
  ): this;
  override on(
    event: string | symbol,
    listener: (...arguments_: any[]) => unknown
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
  async send(...arguments_: Parameters<Requester['send']>): Promise<KafkaBase> {
    return this.requester.send(...arguments_);
  }

  async emitter(...arguments_: Parameters<Requester['emitter']>) {
    return this.requester.emitter(...arguments_);
  }
}
