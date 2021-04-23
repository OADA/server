declare module 'timed-cache' {
  export = class Cache<T> {
    constructor(opts: { defaultTtl: number });
    get(key: string): T;
    put(key: string, val: T): void;
  };
}
