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

import { config } from './config.js';

import { createServer } from 'node:http';

import { collectDefaultMetrics, contentType, register } from 'prom-client';
import type NStats from 'nstats';

collectDefaultMetrics({ register });

let stats: NStats.NStats | undefined;

const nstatsOptional = await import('nstats');
export const nstats: typeof NStats = (...parameters) => {
  stats = nstatsOptional.default(...parameters);
  return stats;
};

const server = createServer(async (_, response) => {
  try {
    const metrics = await register.metrics();
    response.writeHead(200, { 'Content-Type': contentType });

    if (stats) {
      response.write(stats.toPrometheus());
      response.write('\n');
    }

    response.end(metrics);
  } catch (error: unknown) {
    response.writeHead(500);
    // Deepcode ignore ServerLeak: Prometheus port should not be public
    response.end(error);
  }
});

const { port, host } = config.get('prometheus');
server.listen({ host, port });

export * from 'prom-client';
