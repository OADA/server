# @oada/sync-handler

Synchronization and event handling service.

This service processes sync-related requests and participates in event-driven
workflows across OADA services.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/sync-handler run build`
- `yarn workspace @oada/sync-handler run test`
- `yarn workspace @oada/sync-handler run start`

## Notes

- Runs with other core services in docker-compose.
- Uses broker/database settings from shared runtime configuration.
