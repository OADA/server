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

import util from 'util';

import {
  Base,
  CANCEL_KEY,
  CONNECT,
  ConstructorOpts as BaseConstructorOpts,
  DATA,
  KafkaBase,
  REQ_ID_KEY,
  topicTimeout,
} from './base.js';

import debug from 'debug';
import type { EachMessagePayload } from 'kafkajs';
import ksuid from 'ksuid';

const trace = debug('@oada/lib-kafka:trace');
const warn = debug('@oada/lib-kafka:warn');
const error = debug('@oada/lib-kafka:error');

export type Response<R = KafkaBase> = R | Iterable<R> | AsyncIterable<R> | void;

function isIterable<T>(
  val: T | Iterable<T> | AsyncIterable<T>
): val is Iterable<T> | AsyncIterable<T> {
  return (
    typeof val === 'object' &&
    (Symbol.iterator in val || Symbol.asyncIterator in val)
  );
}

export interface ConstructorOpts extends BaseConstructorOpts {
  consumeTopic: string;
  old?: boolean;
}
export class Responder extends Base {
  private timeout;
  private old;
  protected requests: Map<string, Generator<KafkaBase, void> | true>;

  constructor({
    consumeTopic,
    produceTopic = null,
    group,
    old = false,
    ...opts
  }: ConstructorOpts) {
    super({ consumeTopic, produceTopic, group, ...opts });

    this.old = old;
    this.requests = new Map();

    this.timeout = topicTimeout(consumeTopic);

    void this[CONNECT]();
  }

  /**
   * @todo Maybe rearrange type parameters? Maybe make them class params?
   */
  override on<Res, Req = KafkaBase>(
    event: 'request',
    listener: (
      reg: Req & KafkaBase,
      data: EachMessagePayload
    ) => Response<Res> | Promise<Response<Res>>
  ): this;
  override on(
    event: string | symbol,
    listener: (...args: any[]) => unknown
  ): this;
  override on<L extends (...args: any[]) => unknown>(
    event: string | symbol,
    listener: L
  ): this {
    if (event === 'request') {
      // TODO: Probably a better way to handle this event...
      return super.on(DATA, async (req, data) => {
        const { domain, group, resp_partition: part = null } = req;
        const id = req[REQ_ID_KEY] as string;
        trace(req, 'Received request');

        // Check for old messages
        if (!this.old && Date.now() - req.time! >= this.timeout) {
          warn('Ignoring timed-out request');
          return;
        }

        // Check for cancelling request
        if (CANCEL_KEY in req) {
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

        const respond = async (resp: Response) => {
          if (!resp) {
            return;
          }

          const it = isIterable(resp) ? resp : [resp];
          this.requests.set(id, it as Generator<KafkaBase, void>);

          for await (const resp of it) {
            trace(resp, 'received response');
            if (resp[REQ_ID_KEY] === null) {
              // TODO: Remove once everything migrated
              resp[REQ_ID_KEY] = (await ksuid.random()).string;
              util.deprecate(() => {
                return;
              }, 'Please use ReResponder instead')();
            } else {
              resp[REQ_ID_KEY] = id;
              // Check for cancelled requests
              if (!this.requests.has(id)) {
                throw new Error('Request cancelled');
              }
            }

            const mesg = { ...resp, domain, group };
            trace(mesg, 'responding');
            return this.produce({
              mesg,
              part,
            });
          }
        };

        this.requests.set(id, true);
        await this.ready;
        if (listener.length === 3) {
          listener(req, data, respond);
        } else {
          try {
            const resp = (await listener(req, data)) as Response;
            await respond(resp);
          } catch (err: unknown) {
            // Catch and communicate errors over kafka?
            error(err);
            const { code } = (err ?? {}) as { code?: string };
            await respond({
              // eslint-disable-next-line
              code: code ?? err + '',
            });
          }
          this.requests.delete(id);
        }
      });
    } else {
      return super.on(event, listener);
    }
  }
}
