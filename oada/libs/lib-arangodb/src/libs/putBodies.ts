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

import config from '../config.js';
import { db } from '../db.js';

const collection = db.collection(
  config.get('arangodb.collections.putBodies.name')
);

/**
 * Give string of JSON rather than object
 */
export async function savePutBody(body: string): Promise<{ _id: string }> {
  // the _id comes back in the response to save
  return await collection.save(`{"body":${body}}`);
}

export async function getPutBody(id: string): Promise<unknown> {
  const { body } = (await collection.document(id)) as { body: unknown };
  return body;
}

export async function removePutBody(id: string): Promise<void> {
  return void (await collection.remove(id));
}
