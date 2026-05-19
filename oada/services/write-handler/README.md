# @oada/write-handler

Write-path processing service.

This service handles internal write request processing and coordinates
downstream updates/events used by other OADA components.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/write-handler run build`
- `yarn workspace @oada/write-handler run test`
- `yarn workspace @oada/write-handler run start`

## Notes

- Test script builds first, then runs AVA tests.
- Service is part of the core request-processing flow in docker-compose.
