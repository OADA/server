# @oada/tests

Integration-style tests for the OADA reference server.

This package generates client-like requests and verifies behavior across
services, with additional suites for lower-level event checks.

## Prerequisites

- OADA stack running (typically from repo root with `docker-compose`).
- Valid test credentials/tokens where required by test suites.

## Test suite layout

- `selftest/`
  - Basic HTTP request sanity checks against a simple local express test server.
- `test/`
  - Default client-behavior tests.
- `test-lower-level/`
  - Lower-level tests that inspect internal behavior (for example Kafka events).
- `test-host-level/`
  - Host/container behavior tests (currently minimal/placeholder).

## Scripts

Run from `oada/tests`.

```bash
yarn selftestserver
```

Starts the local express server used by `selftest`.

```bash
yarn selftest
```

Runs self-tests with verbose debug output.

```bash
yarn debug
yarn debuglow
yarn debughost
```

Runs standard, lower-level, or host-level suites with test debug logging.

```bash
yarn start
```

Runs the default `test/*.js` suite in production mode settings.
