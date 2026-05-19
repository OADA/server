# OADA micro-services monorepo

This directory contains the application layer of the OADA reference server.
It is a [Yarn workspaces][] monorepo using [Plug'n'Play (PnP)][] with Node.js
`>=24.0.0`.

## Workspace layout

- `services/*`:
  OADA microservices (HTTP/API handlers, auth, startup jobs, etc).
- `libs/*`:
  shared runtime libraries used by the services.
- `tests/`:
  integration-style test package.
- `oada.config.mjs`:
  default runtime configuration used by services.

## Architecture snapshot

- Services are written in JavaScript/TypeScript for [Node.js][].
- Service-to-service communication uses Kafka-compatible brokers (Redpanda by
  default in local compose).
- Persistent storage is [ArangoDB][].
- Local orchestration is defined at repo root in `docker-compose.yml` and
  `common.yml`.

## Prerequisites

- Node.js `>=24.0.0`
- Yarn 4 (`packageManager` is pinned in `package.json`)
- Docker (for local full-stack runs via repo root compose files)

## Common commands

Run these from `oada/`.

```bash
yarn build
```

Builds all workspaces in dependency/topological order.

```bash
yarn workspaces foreach -Apt run test
```

Runs `test` scripts across workspaces that define one.

Target a single workspace while iterating:

```bash
yarn workspace @oada/http-handler run build
yarn workspace @oada/http-handler run test
```

## Service and library inventory

### Services (`services/*`)

- `auth`
- `http-handler`
- `permissions-handler`
- `rev-graph-update`
- `shares`
- `startup`
- `sync-handler`
- `users`
- `webhooks`
- `well-known`
- `write-handler`

### Libraries (`libs/*`)

- `lib-arangodb`
- `lib-config`
- `lib-kafka`
- `lib-prom`
- `models`
- `pino-debug`

Each workspace has a package-level `README.md` for package-specific scripts and
responsibilities.

## Administration CLIs

Workspace `bin` entries in a package `package.json` are exposed as
administrative CLI commands (outside of the OADA HTTP API).

Examples:

- `@oada/users` exposes `add`
- `@oada/auth` exposes `client` and `token`

## Related docs

- Root deployment guide:
  `../README.md`
- Contributor guidance:
  `../AGENTS.md`
- Integration tests package docs:
  `tests/README.md`

[Yarn workspaces]: https://yarnpkg.com/features/workspaces
[Plug'n'Play (PnP)]: https://yarnpkg.com/features/pnp
[Node.js]: https://nodejs.org/en/
[ArangoDB]: https://www.arangodb.com
