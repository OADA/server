# @oada/pino-debug

[![Version](https://img.shields.io/npm/v/@oada/pino-debug.svg)](https://npmjs.org/package/@oada/pino-debug)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![License](https://img.shields.io/github/license/OADA/server)](LICENSE)

A library for handle making
[debug.js][] work automatically with [pino][].

## Usage

Import this library,
then just use [debug.js][] as normal.

```typescript
// You probably want this to be your first import in your main file
import '@oada/pino-debug';

// Then just use debug.js as normal
import debug from 'debug';

const info = debug('example:info');

// Pass a context object and a message string
info({/* ...context */});, 'Hello world!');
```

### Advanced Usage

The [pino][] API can still be accessed too.

```typescript
// If you want to access pino, it is exported by this lib
import { pino } from '@oada/pino-debug';

/**
 * See the pino API for what you can do
 * !!! DO NOT import pino directly !!!
 */
const logger = pino({
  /* ...options */
});
```

[debug.js]: https://github.com/debug-js/debug
[pino]: https://github.com/pinojs/pino
