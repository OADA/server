# OADA Prometheus client

[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![License](https://img.shields.io/github/license/OADA/server)](LICENSE)

A high-level Prometheus client using [prom-client][].
It automatically handles initializing a client for you and exposing the metrics over HTTP.

Default metrics recommended by Prometheus are automatically registered.
You can, and likely should, register your own additional [metrics][].

## Usage

```typescript
// See prom-client README for details on available metric types
import { Counter, Gauge, Histogram, Summary } from '@oada/lib-prom';

// Create metric(s) of your own
const counter = new client.Counter({
  name: 'metric_name',
  help: 'metric_help',
});

// ...Your code here...

// Update your metrics as needed
counter.inc(); // e.g., increment a counter

// ...Your code here...

// Any metrics you create will be exported over HTTP for Prometheus to scrape
```

[prom-client]: https://github.com/siimon/prom-client
[metrics]: https://github.com/siimon/prom-client#custom-metrics
