declare module 'timed-cache' {
  export = class Cache<T> {
    constructor(options: { defaultTtl: number });
    get(key: string): T;
    put(key: string, value: T): void;
  };
}
