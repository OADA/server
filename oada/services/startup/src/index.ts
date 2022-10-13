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

import http from 'node:http';

import { init as initArangoDB } from '@oada/lib-arangodb';
import { init as initKafka } from '@oada/lib-kafka';

import debug from 'debug';

const trace = debug('startup:trace');
const info = debug('startup:info');

const port = process.env.PORT ?? 8080;
const exit = process.env.EXIT ?? false;

info('Startup is initializing ArangoDB and Kafka');
await Promise.all([initArangoDB.run(), initKafka.run()]);
info('Initialization complete');

if (exit) {
  // eslint-disable-next-line no-process-exit, unicorn/no-process-exit
  process.exit(0);
}

const server = http.createServer((request, response) => {
  trace(request, 'Request received');
  response.write('Hello');
  response.end();
});
server.on('listening', () => {
  info(server.address(), 'Startup finished, listening');
});

server.listen(port);
