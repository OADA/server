declare module 'es-main' {
  function esMain(meta: any): boolean;
  export = esMain;
}

// Make TS understand assert better
declare module 'assert' {
  function internal(value: any, message?: string | Error): asserts value;
}
