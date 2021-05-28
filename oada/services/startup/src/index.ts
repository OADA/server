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

import http from 'http';

import { init } from '@oada/lib-arangodb';
import debug from 'debug';

const trace = debug('startup:trace');
const info = debug('startup:info');

const port = process.env.PORT || 8080;

const server = http.createServer((req, res) => {
  trace('Request received: %O', req);
  res.write('Hello');
  res.end();
});
server.on('listening', () =>
  info('Startup finished, listening on %o', server.address())
);

info('Startup is creating database');
init.run().then(() => {
  info('Database created/ensured.');
  server.listen(port);
});
