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

import util from 'node:util';

import {
  Base,
  type ConstructorOptions as BaseConstructorOptions,
  CANCEL_KEY,
  DATA,
  type KafkaBase,
  REQ_ID_KEY,
  topicTimeout,
} from './Base.js';

import type { EachMessagePayload } from 'kafkajs';
import debug from 'debug';
import ksuid from 'ksuid';
import rTracer from 'cls-rtracer';

const trace = debug('@oada/lib-kafka:trace');
const warn = debug('@oada/lib-kafka:warn');
const error = debug('@oada/lib-kafka:error');

export type Response<R = KafkaBase> = R | Iterable<R> | AsyncIterable<R> | void;

function isIterable<T>(
  value: T | Iterable<T> | AsyncIterable<T>
): value is Iterable<T> | AsyncIterable<T> {
  return (
    value &&
    typeof value === 'object' &&
    (Symbol.iterator in value || Symbol.asyncIterator in value)
  );
}

export interface ConstructorOptions extends BaseConstructorOptions {
  consumeTopic: string;
  old?: boolean;
}
export class Responder<Request extends KafkaBase = KafkaBase> extends Base {
  protected requests: Map<string, Generator<KafkaBase, void> | true>;
  readonly #timeout;
  readonly #old;

  constructor({
    consumeTopic,
    produceTopic,
    group,
    old = false,
    ...options
  }: ConstructorOptions) {
    super({ consumeTopic, produceTopic, group, ...options });

    this.#old = old;
    this.requests = new Map();

    this.#timeout = topicTimeout(consumeTopic);

    void this.connect();
  }

  /**
   * @todo Maybe rearrange type parameters? Maybe make them class params?
   */
  override on<R>(
    event: 'request',
    listener: (
      reg: Request,
      data: EachMessagePayload
    ) => Response<R> | Promise<Response<R>>
  ): this;
  override on(
    event: string | symbol,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    listener: (...arguments_: any[]) => unknown
  ): this;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override on<L extends (...arguments_: any[]) => unknown>(
    event: string | symbol,
    listener: L
  ): this {
    if (event === 'request') {
      // FIXME: Probably a better way to handle this event...
      return super.on(DATA, async (request, data) => {
        await this.#handleRequest(request as Request, data, listener);
      });
    }

    return super.on(event, listener);
  }

  /**
   * Handle a new incoming Kafka request
   */
  async #handleRequest<R>(
    request: Request,
    data: EachMessagePayload,
    listener: (
      request: Request,
      data: EachMessagePayload
    ) => Response<R> | Promise<Response<R>>
  ) {
    const { [REQ_ID_KEY]: id = '', time } = request;
    await rTracer.runWithId(async () => {
      trace(request, 'Received request');

      // Check for old messages
      if (!this.#old && Date.now() - time! >= this.#timeout) {
        warn('Ignoring timed-out request');
        return;
      }

      // Check for cancelling request
      if (CANCEL_KEY in request) {
        const gen = this.requests.get(id) as
          | Generator<KafkaBase, void>
          | undefined;
        this.requests.delete(id);

        if (typeof gen?.return === 'function') {
          // Stop generator
          gen.return();
        }

        return;
      }

      this.requests.set(id, true);
      await this.ready;
      try {
        const resp = (await listener(request, data)) as Response;
        await this.#respond(request, resp);
      } catch (cError: unknown) {
        // Catch and communicate errors over kafka?
        error({ error: cError }, 'Error in listener');
        const { code } = (cError ?? {}) as { code?: string };
        await this.#respond(request, {
          code: code ?? `${cError}`,
        });
      }

      this.requests.delete(id);
    }, id ?? rTracer.id());
  }

  /**
   * Send response(s) back to the original request
   */
  async #respond(
    { [REQ_ID_KEY]: id = '', domain, group, resp_partition: part = 0 }: Request,
    resp: Response
  ) {
    if (!resp) {
      return;
    }

    const it = isIterable(resp) ? resp : [resp];
    this.requests.set(id, it as Generator<KafkaBase, void>);

    for await (const r of it) {
      trace(r, 'received response');
      // eslint-disable-next-line security/detect-object-injection
      if (r[REQ_ID_KEY] === null) {
        // FIXME: Remove once everything migrated
        const { string: newId } = await ksuid.random();
        // eslint-disable-next-line security/detect-object-injection
        r[REQ_ID_KEY] = newId;
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        util.deprecate(() => {}, 'Please use ReResponder instead')();
      } else {
        // eslint-disable-next-line security/detect-object-injection
        r[REQ_ID_KEY] = id;
        // Check for cancelled requests
        if (!this.requests.has(id)) {
          throw new Error('Request cancelled');
        }
      }

      const mesg = { ...r, domain, group };
      trace(mesg, 'responding');
      await this.produce({
        mesg,
        part,
      });
    }
  }
}
