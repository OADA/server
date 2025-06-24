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

import debug from "debug";
import type { EventEmitter } from "eventemitter3";
import type { EachMessagePayload } from "kafkajs";
import { Base, DATA, type KafkaBase } from "./Base.js";
import {
  Requester,
  type ConstructorOptions as RequesterOptions,
} from "./Requester.js";
import {
  Responder,
  type ConstructorOptions as ResponderOptions,
  type Response,
} from "./Responder.js";

const trace = debug("@oada/lib-kafka:trace");

class DummyResponder extends Responder {
  constructor(options: ResponderOptions, ready: Promise<unknown>) {
    super(options);
    this.ready = ready;
  }

  override async connect(): Promise<void> {
    // Don't connect to Kafka
  }
}
class DummyRequester extends Requester {
  constructor(options: RequesterOptions, ready: Promise<unknown>) {
    super(options);
    this.ready = ready;
  }

  override async connect(): Promise<void> {
    // Don't connect to Kafka
  }
}

export type ConstructorOptions = Omit<
  ResponderOptions & RequesterOptions,
  "consumeTopic" | "produceTopic"
> & {
  respondOwn?: boolean;
  requestTopics: { consumeTopic: string; produceTopic: string };
  respondTopics: { consumeTopic: string; produceTopic: string };
};
/**
 * Class for when responding to requests requires making other requests
 */
export class ResponderRequester extends Base {
  readonly #responder: DummyResponder;
  readonly #requester: DummyRequester;
  readonly #respondOwn;

  constructor({
    requestTopics,
    respondTopics,
    group,
    respondOwn = false,
    ...options
  }: ConstructorOptions) {
    super({
      consumeTopic: [requestTopics.consumeTopic, respondTopics.consumeTopic],
      group,
      ...options,
    });

    this.#respondOwn = respondOwn;

    // Make a Responder and Requester using our consumer/producer
    this.#responder = new DummyResponder(
      {
        consumer: this.consumer,
        producer: this.producer,
        group,
        ...respondTopics,
        ...options,
      },
      this.ready,
    );
    this.#requester = new DummyRequester(
      {
        consumer: this.consumer,
        producer: this.producer,
        group,
        ...requestTopics,
        ...options,
      },
      this.ready,
    );

    // Mux the consumer between requester and responder
    this.on(DATA, (data: KafkaBase, payload, ...rest: unknown[]) => {
      trace({ payload, data }, "Received data");
      if (this.#requester.consumeTopics.includes(payload.topic)) {
        trace("Muxing data to requester");
        this.#requester.emit(DATA, data, payload, ...rest);
      }

      if (this.#responder.consumeTopics.includes(payload.topic)) {
        if (!this.#respondOwn && data.group === this.group) {
          // Don't respond to own requests
          return;
        }

        trace("Muxing data to responder");
        this.#responder.emit(DATA, data, payload, ...rest);
      }
    });

    void this.connect();
  }

  /**
   * @todo Maybe rearrange type parameters? Maybe make them class params?
   */
  override on<R, Request = KafkaBase>(
    event: "request",
    listener: (reg: Request & KafkaBase) => Response<R> | Promise<Response<R>>,
  ): this;

  override on(
    event: typeof DATA,
    listener: (
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resp: any,
      payload: EachMessagePayload,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ...rest: any[]
    ) => unknown,
  ): this;

  override on(
    event: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...arguments_: any[]) => unknown,
  ): this;

  override on(
    event: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...arguments_: any[]) => unknown,
  ): this {
    switch (event) {
      case "ready": {
        super.on("ready", listener);
        break;
      }

      case DATA: {
        super.on(DATA, listener);
        break;
      }

      default: {
        this.#requester.on(event, listener);
        this.#responder.on(event, listener);
        break;
      }
    }

    return this;
  }

  // TODO: Is it better to just extend Requester?
  async send(...rest: Parameters<Requester["send"]>): Promise<KafkaBase> {
    return this.#requester.send(...rest);
  }

  async emitter(
    ...rest: Parameters<Requester["emitter"]>
  ): Promise<EventEmitter & { close(): Promise<void> }> {
    return this.#requester.emitter(...rest);
  }
}
