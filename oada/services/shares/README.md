# @oada/shares

Service for OADA sharing-related behavior.

This service handles internal logic for resource sharing workflows.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/shares run build`
- `yarn workspace @oada/shares run test`
- `yarn workspace @oada/shares run start`

## Notes

- Participates in the microservice request flow through the Kafka broker.
- Uses central config and environment settings from the monorepo runtime.
