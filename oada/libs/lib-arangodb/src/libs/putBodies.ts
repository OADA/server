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

import { config } from '../config.js';
import { db as database } from '../db.js';

const collection = database.collection<{body: unknown}>(
  config.get('arangodb.collections.putBodies.name'),
);

/**
 * Give string of JSON rather than object
 */
export async function savePutBody(body: string): Promise<{ _id: string }> {
  // @ts-expect-error HACK: send body without parsing it
  const { _id } = await collection.save(`{"body":${body}}`);
  return { _id };
}

export async function getPutBody(id: string): Promise<unknown> {
  const { body } = await collection.document(id);
  return body;
}

export async function removePutBody(id: string): Promise<void> {
  await collection.remove(id);
}