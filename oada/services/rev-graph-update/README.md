# @oada/rev-graph-update

Revision graph maintenance service.

This service updates revision/graph-related state used by other OADA services.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/rev-graph-update run build`
- `yarn workspace @oada/rev-graph-update run test`
- `yarn workspace @oada/rev-graph-update run start`

## Notes

- Test script builds first, then runs AVA tests.
- Depends on shared Kafka and ArangoDB integrations.
