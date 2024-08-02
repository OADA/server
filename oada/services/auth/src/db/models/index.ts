/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import path from 'node:path';
import url from 'node:url';

const dirname = path.dirname(url.fileURLToPath(import.meta.url));

export interface Store {
  name: string;
}

export async function getDataStores<T extends Store>(
  stores: string | readonly string[],
  item: string,
): Promise<T[]> {
  const array = Array.isArray(stores) ? stores : [stores];
  const promises = array.map(async (dataStore) => {
    const store: unknown = await import(
      path.join(dirname, '..', dataStore, `${item}.js`)
    );
    return {
      name: dataStore,
      // @ts-expect-error stuff
      ...store,
    } as T;
  });

  return Promise.all(promises);
}

/**
 * Try `queryFun` against all configured data stores in order
 */
export async function tryDataStores<T extends Store, R>(
  stores: readonly T[],
  queryFun: (store: T) => Promise<R | undefined>,
) {
  const errors: Error[] = [];
  for await (const store of stores) {
    try {
      const value = await queryFun(store);
      if (value) {
        return value;
      }
    } catch (cError: unknown) {
      errors.push(cError as Error);
    }
  }

  if (errors.length === 0) {
    return;
  }

  const names = stores.map(({ name }) => name);
  throw new Error(`${queryFun.name} failed to find result(s) among ${names}`, {
    cause: errors,
  });
}
