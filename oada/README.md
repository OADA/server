# OADA micro-services

This is a [yarn 3 monorepo][] using [pnp][].
It contains all the core "OADA" micro-services of the reference implementation,
as well as some libraries for said services.

## Architecture

The services are all JavaScript/TypeScript which runs in [Node.js][].

Messages between services are communicated via [kafka][],
and the underlying database used is [arangodb][].

## Administration commands

Any `bin`s available in the `package.json`
will be exposed as an administration CLI command (not via the OADA API).
For example, the [`users`][] service has an `add` command
(see [here](services/users/package.json)).

[`users`]: services/users
[yarn 3 monorepo]: https://yarnpkg.com/features/workspaces
[pnp]: https://yarnpkg.com/features/pnp
[node.js]: https://nodejs.org/en/
[arangodb]: https://www.arangodb.com
[kafka]: https://kafka.apache.org
