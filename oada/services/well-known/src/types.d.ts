declare module 'oada-error' {
  import { Request, Response, NextFunction } from 'express';

  export class OADAError extends Error {
    constructor(mesg: string, code?: codes);
  }
  export const enum codes {
    NOT_FOUND = 404,
  }
  export function middleware(
    cb: (...args: unknown[]) => void
  ): (err: Error, req: Request, res: Response, nex: NextFunction) => void;
}

declare module '@oada/well-known-json' {
  import { Request, Response, NextFunction } from 'express';

  const wellKnown: {
    (opts: { forceProtocol?: string }): {
      (req: Request, res: Response, next: NextFunction): void;
      addResource(uri: string, obj: Record<string, unknown>): void;
    };
  };

  export = wellKnown;
}
