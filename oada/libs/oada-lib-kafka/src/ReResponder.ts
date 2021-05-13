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

import ksuid from 'ksuid';

import { REQ_ID_KEY, DATA } from './base';
import { Responder } from './Responder';

// Class for generate new requests in response to others
// (without needing the answer)
export class ReResponder extends Responder {
  constructor(...args: ConstructorParameters<typeof Responder>) {
    super(...args);

    // Make everything look like a new request
    super.prependListener(DATA, (req) => {
      req[REQ_ID_KEY] = ksuid.randomSync().string;
    });
  }
}