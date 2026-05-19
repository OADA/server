# @oada/lib-arangodb

Shared ArangoDB integration library for OADA services.

This package contains common ArangoDB access and initialization code used by
multiple microservices.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/lib-arangodb run build`
- `yarn workspace @oada/lib-arangodb run test`
- `yarn workspace @oada/lib-arangodb run init`

## CLI commands

- `import`:
  runs `dist/import.js` for ArangoDB import workflows.

## Notes

- Test script builds first, then runs AVA tests.
