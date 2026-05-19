# @oada/startup

Startup/orchestration initialization service for the OADA stack.

This service performs startup-time setup tasks used by the docker-based
reference deployment.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/startup run build`
- `yarn workspace @oada/startup run start`

## Notes

- `test` is currently a placeholder script in this package.
- The docker-compose `startup` service runs before most other OADA services.
