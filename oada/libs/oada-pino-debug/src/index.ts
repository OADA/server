import { resolve } from 'path';

import _pino from 'pino';
import pinoDebug, { Options } from 'pino-debug';
import debug from 'debug';

/**
 * Default mappings of debug namespaces to pino levels
 */
export const defaultMap = <const>{
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
};

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
    // ensure levels are sorted by value
    ([_1, v1], [_2, v2]) => v1 - v2
  );
  for (const [label] of levels) {
    if (debug.enabled(`:${label}`)) {
      return label;
    }
  }

  // Assume silent
  return 'silent';
}

/**
 * Get pino, wrapping it with pino-caller when in development environment
 */
export function pino({
  level = logLevel(),
  ...opts
}: _pino.LoggerOptions = {}): _pino.Logger {
  const p = _pino({ level, ...opts });
  return process.env.NODE_ENV === 'development' ? require('pino-caller')(p) : p;
}

/**
 * Give use better defaults for pino-debug?
 */
export default function oadaDebug(
  logger: _pino.Logger = pino(),
  {
    // Turn off auto so only things enabled in DEBUG var get logged
    auto = false,
    map: mmap,
    ...rest
  }: Options = {}
) {
  // Load mappings from files
  const fmap =
    process.env.OADA_PINO_MAP &&
    require(resolve(process.cwd(), process.env.OADA_PINO_MAP)); // nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
  // Merge in mappings
  const map = Object.assign({}, defaultMap, fmap, mmap);
  return pinoDebug(logger, { auto, map, ...rest });
}

if (
  module.parent &&
  module.parent.parent === null &&
  module.parent.filename === null
) {
  // preloaded with -r flag
  oadaDebug();
}
