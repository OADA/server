/**
 * @license
 * Copyright 2021 Open Ag Data Alliance
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

/* eslint-disable unicorn/prefer-module */
/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable security/detect-non-literal-require */
/* eslint-disable import/no-dynamic-require */

import { resolve } from 'node:path';

// !!! This needs to be imported before _anything_ using pino or debug
import pinoDebug from 'pino-debug';

import type { Logger, LoggerOptions } from 'pino';
import _pino from 'pino';
import debug from 'debug';
import isInteractive from 'is-interactive';
import pinoCaller from 'pino-caller';
import rTracer from 'cls-rtracer';

const interactive = isInteractive();

/**
 * Default mappings of debug namespaces to pino levels
 */
export const defaultMap = {
  '*:info': 'info',
  'info:*': 'info',
  '*:warn': 'warn',
  'warn:*': 'warn',
  '*:trace': 'trace',
  'trace:*': 'trace',
  '*:debug': 'debug',
  'debug:*': 'debug',
  '*:error': 'error',
  'error:*': 'error',
  '*:fatal': 'fatal',
  'fatal:*': 'fatal',
  // Send anything unspecified to debug?
  '*': 'debug',
} as const;

/**
 * Get current logging level based on PINO_LEVEL or DEBUG env vars
 */
export function logLevel(): string {
  // Allow specifying a level via env
  if (process.env.PINO_LEVEL) {
    return process.env.PINO_LEVEL;
  }

  // Guess level based on OADA debug namespaces (e.g., *:info -> info log level)
  const levels = Object.entries(_pino.levels.values).sort(
    // Ensure levels are sorted by value
    ([_1, v1], [_2, v2]) => v1 - v2
  );
  for (const [label] of levels) {
    if (debug.enabled(`:${label}`)) {
      return label;
    }
  }

  if (interactive) {
    // Default to info for interactive shells?
    return 'info';
  }

  // Assume silent
  return 'silent';
}

export const mixins: Array<() => Record<string, unknown>> = [
  () => ({ reqId: rTracer.id() }),
];

/**
 * Get pino, wrapping it with fanciness when in development environment
 */
function createRootLogger(): Logger {
  const development = process.env.NODE_ENV === 'development';
  const redact =
    process.env.PINO_REDACT?.split(',') ??
    (interactive
      ? []
      : [
          'password',
          '*.password',
          '*.*.password',
          'token',
          '*.token',
          '*.*.token',
        ]);
  const level = logLevel();
  const transport = interactive ? { target: 'pino-pretty' } : undefined;
  const log = _pino({
    name: require.main?.id ?? process.env.npm_package_name,
    level,
    transport,
    redact,
    mixin() {
      const objs = mixins.map((f) => f());
      return Object.assign({}, ...objs) as Record<string, unknown>;
    },
  });
  const logger = development ? pinoCaller(log) : log;

  // Load mappings from files
  const fMap = (process.env.OADA_PINO_MAP &&
    require(resolve(process.cwd(), process.env.OADA_PINO_MAP))) as  // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
    | undefined
    | Record<string, string>;
  // Merge in mappings
  const map = { ...defaultMap, ...fMap };
  pinoDebug(logger, {
    // Turn off auto so only things enabled in DEBUG var get logged
    auto: interactive,
    map,
  });

  return logger;
}

const rootLogger = createRootLogger();
export function pino(options: LoggerOptions = {}): Logger {
  return rootLogger.child(options);
}
