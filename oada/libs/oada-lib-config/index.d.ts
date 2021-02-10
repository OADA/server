import type { Provider } from 'nconf';

declare function config(defaults: any): Provider;
export = config;
