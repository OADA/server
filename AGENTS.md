# AGENTS

This file is guidance for human and AI contributors working in this repository.

## Repository map

- `README.md` (repo root):
  deployment-first docs for docker-compose and Kubernetes/Helm usage.
- `oada/`:
  Yarn 4 monorepo containing the OADA microservices and shared libraries.
- `charts/oada/`:
  Helm chart for cluster deployments.
- `support/`:
  supporting images and config (for example proxy images).

Treat the repository as two layers:

1. Infrastructure/deployment layer at repo root.
2. Application/workspace layer in `oada/`.

## Toolchain and runtime

- Package manager:
  Yarn 4 (`packageManager` in `oada/package.json`).
- Workspace mode:
  Yarn workspaces with Plug'n'Play (PnP).
- Node.js:
  `>=24.0.0` for `oada/` workspaces.
- Language:
  TypeScript/JavaScript with strict TypeScript settings.
- Lint/format:
  Biome (configured at root and extended in `oada/`).

Do not switch package managers or introduce lockfiles from npm/pnpm.

## Where to run commands

- Run root deployment commands (docker-compose, Helm related commands) from repo
  root.
- Run workspace/package commands from `oada/`.

Common monorepo commands:

```bash
cd oada
yarn build
yarn workspaces foreach -Apt run test
```

Target a single workspace when iterating locally:

```bash
cd oada
yarn workspace @oada/http-handler run build
yarn workspace @oada/http-handler run test
```

## Architecture snapshot

- Services under `oada/services/*` communicate through Kafka/Redpanda.
- Primary data store is ArangoDB.
- Service runtime configuration is driven by `oada/oada.config.mjs` and
  environment variables.
- Local orchestration is defined in `docker-compose.yml` with shared defaults in
  `common.yml`.

## Documentation expectations

When adding or changing behavior:

- Update the closest README first (package-level if scoped, `oada/README.md` if
  monorepo-wide, root `README.md` if deployment-wide).
- Keep service and library READMEs concise and script-accurate.
- Prefer linking to canonical docs instead of duplicating long setup
  instructions.

## Change safety and scope

- Keep changes narrowly scoped to the requested task.
- Do not revert unrelated user changes in a dirty working tree.
- Avoid destructive git commands (`reset --hard`, force pushes) unless
  explicitly requested.
- Prefer incremental doc updates over broad rewrites when preserving historical
  reference content matters.

## Validation checklist for doc and code changes

For doc-only changes:

- Ensure links resolve and command snippets match actual scripts.

For code changes in `oada/`:

- Build:
  `cd oada && yarn build`
- Test (broad):
  `cd oada && yarn workspaces foreach -Apt run test`
- Targeted workspace checks for touched packages when full test run is too
  expensive.

## Helpful entry points

- Root overview:
  `README.md`
- Monorepo contributor guide:
  `oada/README.md`
- Integration tests docs:
  `oada/tests/README.md`
- Helm deployment docs:
  `charts/oada/README.md`
