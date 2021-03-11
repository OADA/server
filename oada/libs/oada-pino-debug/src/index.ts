import { resolve } from 'path';

import _pino, { LoggerOptions } from 'pino';
import pinoDebug, { Logger, Options } from 'pino-debug';

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
 * Get pino, wrapping it with pino-caller when in development environment
 */
export function pino(opts: LoggerOptions) {
  const p = _pino(opts ?? { level: 'trace' });
  return process.env.NODE_ENV === 'development' ? require('pino-caller')(p) : p;
}

/**
 * Give use better defaults for pino-debug?
 */
export default function oadaDebug(
  // Turn on all the log levels by default
  logger: Logger = pino({ level: 'trace' }),
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
    require(resolve(process.cwd(), process.env.OADA_PINO_MAP));
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
