# @oada/permissions-handler

Permissions evaluation service for OADA resource requests.

This service participates in the internal request pipeline to enforce
authorization decisions.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/permissions-handler run build`
- `yarn workspace @oada/permissions-handler run test`
- `yarn workspace @oada/permissions-handler run start`

## Notes

- Uses shared OADA libraries from `oada/libs/*`.
- Runtime wiring is configured through `oada/oada.config.mjs`.
