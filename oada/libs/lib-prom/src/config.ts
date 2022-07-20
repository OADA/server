/**
 * @license
 * Copyright 2022 Open Ag Data Alliance
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

import libConfig from '@oada/lib-config';

export const { config, schema } = await libConfig({
  prometheus: {
    port: {
      doc: 'Port for exposing metrics endpoint',
      format: 'port',
      default: 3000,
      env: 'PROM_PORT',
      arg: 'prom-port',
    },
    endpoint: {
      doc: 'Endpoint for exposing metrics',
      format: String,
      default: '/metrics',
      env: 'PROM_ENDPOINT',
      arg: 'prom-endpoint',
    },
    host: {
      doc: 'Bind host for exposing metrics endpoint',
      format: String,
      default: 'localhost',
      env: 'PROM_HOST',
      arg: 'prom-host',
    },
  },
});
