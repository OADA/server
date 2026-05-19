# @oada/http-handler

HTTP entrypoint service for the OADA stack.

This service accepts incoming HTTP requests and forwards work into the
asynchronous service pipeline.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/http-handler run build`
- `yarn workspace @oada/http-handler run test`
- `yarn workspace @oada/http-handler run start`
- `yarn workspace @oada/http-handler run healthcheck`

## Notes

- In local docker-compose, this service is reachable through the `proxy`
  service.
- Runtime configuration comes from `oada/oada.config.mjs` and environment
  values.
