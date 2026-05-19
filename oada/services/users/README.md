# @oada/users

User administration service.

This package contains runtime user-related service logic and user administration
CLI commands.

## Scripts

Run from `oada/`:

- `yarn workspace @oada/users run build`
- `yarn workspace @oada/users run start`

## CLI commands

The package exposes an administrative CLI binary:

- `add`:
  creates users (used by docker-compose workflows and local admin tasks)

## Notes

- User bootstrap commands are commonly run from repo root using docker-compose.
