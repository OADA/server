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

// TODO: Publish this to npm instead?
import libConfig from '@oada/lib-config';

export const { config, schema } = await libConfig({
  kafka: {
    topics: {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      default: {
        writeRequest: 'write_request',
        httpResponse: 'http_response',
      } as Record<string, string>,
    },
  },
});
