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

import { config } from './config.js';

import { createServer } from 'node:http';

import {
  Gauge,
  type MetricConfiguration,
  collectDefaultMetrics,
  register,
} from 'prom-client';
import type NStats from 'nstats';

collectDefaultMetrics({ register });

let stats: NStats.NStats | undefined;

const nstatsOptional = await import('nstats');
export const nstats: typeof NStats = (...parameters) => {
  stats = nstatsOptional.default(...parameters);
  return stats;
};

/**
 * HTTP server to exposing metrics for Prometheus to scrape
 *
 * *Starts automatically, don't try to start manually.*
 */
// eslint-disable-next-line sonarjs/no-misused-promises
export const server = createServer(async (_, response) => {
  try {
    const metrics = await register.metrics();
    response.writeHead(200, { 'Content-Type': register.contentType });

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

// Automatically start server to expose metrics
const { port, host } = config.get('prometheus');
server.listen({ host, port });

export * from 'prom-client';

export interface PseudoMetricConfiguration<T extends string> {
  name: `${string}_info`;
  help: string;
  labels?: Record<T, string>;
  collect?: (this: PseudoMetric<T>) => void | Promise<void>;
  registers?: MetricConfiguration<T>['registers'];
}

/**
 * A pseudo-metric that provides metadata about the process to prometheus
 *
 * The lables are the reported metadata
 *
 * @see {@link https://www.robustperception.io/exposing-the-software-version-to-prometheus/}
 */
export class PseudoMetric<T extends string = string> {
  readonly #gauge;

  constructor({
    name,
    help,
    labels,
    registers,
    collect = () => {
      this.set(labels!);
    },
  }: PseudoMetricConfiguration<T>) {
    this.#gauge = new Gauge<T>({
      name,
      help,
      aggregator: 'first',
      registers,
      collect: () => collect.call(this),
    });
  }

  /**
   * !! ***You should only call this from within a collect callback***
   */
  public set(labels: Record<T, string>) {
    this.#gauge.set(labels, 1);
  }
}
