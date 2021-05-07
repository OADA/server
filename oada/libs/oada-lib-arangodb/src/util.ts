/* Copyright 2021 Open Ag Data Alliance
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

import type { ArrayCursor } from 'arangojs/cursor';
import type Bluebird from 'bluebird';

export function sanitizeResult<T extends Record<string, any>>(
  res: T
): Omit<T, '_key' | '_oada_rev'> {
  if (res === undefined || res === null) {
    return res;
  }

  if (res._key) {
    delete res._key;
  }
  if (res['_oada_rev']) {
    // @ts-ignore
    res._rev = res['_oada_rev'];
    delete res['_oada_rev'];
  }
  return res;
}

// Make arango cursor work with bluebird like an array
//
// This was too much trouble to fix for TS...
export function bluebirdCursor<T>(cur: Promise<ArrayCursor<T>>): Bluebird<T[]> {
  // Make .then exhaust the cursor
  let then = cur.then.bind(cur);
  cur.then = (f: any) => then((cur) => cur.all()).then(f);
  (<const>['each', 'any', 'some', 'map', 'reduce']).forEach((meth) => {
    // @ts-ignore
    cur[meth] = async function () {
      let args = arguments;
      // @ts-ignore
      return cur.then((cur) => ccur[meth].apply(cur, args));
    };
  });

  return cur as Bluebird<T[]>;
}
