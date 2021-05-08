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

import ksuid from 'ksuid';
import debug from 'debug';

import {
  Base,
  topicTimeout,
  CONNECT,
  DATA,
  REQ_ID_KEY,
  CANCEL_KEY,
  ConstructorOpts as BaseConstructorOpts,
  KafkaBase,
} from './base';

const trace = debug('@oada/lib-kafka:trace');
const warn = debug('@oada/lib-kafka:warn');

export type Response =
  | KafkaBase
  | Iterable<KafkaBase>
  | AsyncIterable<KafkaBase>
  | undefined;

function isIterable<T>(
  val: T | Iterable<T> | AsyncIterable<T>
): val is Iterable<T> | AsyncIterable<T> {
  return (
    typeof val === 'object' &&
    typeof (
      // @ts-ignore
      val[Symbol.iterator]
    ) === 'function'
  );
}

export interface ConstructorOpts extends BaseConstructorOpts {
  consumeTopic: string;
  old?: boolean;
}
export class Responder extends Base {
  private timeout;
  private old;
  protected requests: Record<string, Generator<KafkaBase, void> | true>;

  constructor({
    consumeTopic,
    produceTopic = null,
    group,
    old = false,
    ...opts
  }: ConstructorOpts) {
    super({ consumeTopic, produceTopic, group, ...opts });

    this.old = old;
    this.requests = {};

    this.timeout = topicTimeout(consumeTopic);

    this[CONNECT]();
  }

  on(event: 'request', listener: (reg: KafkaBase) => Response): this;
  on(event: string | symbol, listener: (...args: any[]) => unknown): this;
  on(event: string | symbol, listener: (...args: any[]) => unknown): this {
    if (event === 'request') {
      // TODO: Probably a better way to hande this event...
      return super.on(DATA, async (req, data) => {
        const self = this;
        const { domain, group, resp_partition: part = null } = req;
        const id = req[REQ_ID_KEY];
        trace('Received request %s', id);

        // Check for old messages
        if (!this.old && Date.now() - req.time >= this.timeout) {
          warn('Ignoring timed-out request');
          return;
        }

        // Check for cancelling request
        if (req[CANCEL_KEY]) {
          const gen = this.requests[id] as
            | Generator<KafkaBase, void>
            | undefined;
          delete this.requests[id];

          if (typeof gen?.return === 'function') {
            // Stop generator
            gen.return();
          }

          return;
        }

        this.requests[id] = true;
        await this.ready;
        if (listener.length === 3) {
          listener(req, data, respond);
        } else {
          const resp = (await listener(req, data)) as Response;
          await respond(resp);
          delete this.requests[id];
        }

        async function respond(resp: Response) {
          if (!resp) {
            return;
          }

          const it = isIterable(resp) ? resp : [resp];
          self.requests[id] = it as Generator<KafkaBase, void>;

          for await (const resp of it) {
            if (resp[REQ_ID_KEY] === null) {
              // TODO: Remove once everything migrated
              resp[REQ_ID_KEY] = ksuid.randomSync().string;
              util.deprecate(() => {}, 'Please use ReResponder instead')();
            } else {
              resp[REQ_ID_KEY] = id;
              // Check for cancelled requests
              if (!self.requests[id]) {
                throw new Error('Request cancelled');
              }
            }

            return self.produce({
              mesg: { ...resp, domain, group },
              part,
            });
          }
        }
      });
    } else {
      return super.on(event, listener);
    }
  }
}
