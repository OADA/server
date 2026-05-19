# @oada/well-known

`.well-known` discovery document service for OADA deployments.

This service serves OADA/OIDC metadata and can merge details from supporting
sub-services based on configuration.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/well-known run build`
- `yarn workspace @oada/well-known run start`

## Notes

- `test` is currently a placeholder script in this package.
- `oada.config.mjs` contains the `wellKnown` configuration, including merged
  sub-service metadata.
