# @oada/lib-kafka

Shared Kafka client helpers for OADA services.

This library provides common Kafka integration logic used across the
microservice set.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/lib-kafka run build`
- `yarn workspace @oada/lib-kafka run test`

## Notes

- Test script builds first, then runs AVA tests.
- Broker configuration is provided through the central OADA config/env layer.
