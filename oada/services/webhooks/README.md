# @oada/webhooks

Webhook delivery and management service.

This service handles webhook-related request processing and outbound event
delivery behavior.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/webhooks run build`
- `yarn workspace @oada/webhooks run test`
- `yarn workspace @oada/webhooks run start`

## Notes

- Integrates with the broader Kafka-based event pipeline.
- Runtime options come from the shared monorepo config and environment.
