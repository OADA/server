declare module 'oada-error' {
  import {
    NextFunction,
    NextFunction,
    Request,
    Request,
    Response,
    Response,
  } from 'express';

  export class OADAError extends Error {
    constructor(mesg: string, code?: codes);
  }
  export const enum codes {
    NOT_FOUND = 404,
  }
  export function middleware(
    callback: (...arguments_: unknown[]) => void
  ): (error: Error, request: Request, res: Response, nex: NextFunction) => void;
}

declare module '@oada/well-known-json' {
  const wellKnown: (options: { forceProtocol?: string }) => {
    (request: Request, res: Response, next: NextFunction): void;
    addResource(uri: string, object: Record<string, unknown>): void;
  };

  export = wellKnown;
}
