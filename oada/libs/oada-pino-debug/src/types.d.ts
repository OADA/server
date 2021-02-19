declare module 'pino-debug' {
  export type { Logger } from 'pino';

  export interface Options {
    /**
     * @default {}
     */
    map?: Record<string, string>;
    /**
     * @default true
     */
    auto?: boolean;
    skip?: readonly string[];
  }

  function pinoDebug(logger: Logger, opts: Options);

  export = pinoDebug;
}
