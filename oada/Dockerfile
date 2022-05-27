ARG NODE_VER=18-alpine

# Copy in package files and any needed apt packages?
FROM node:${NODE_VER} AS packages

WORKDIR /oada

# Need to list out every package.json we need from monorepo for caching stuff...
COPY ./yarn.lock ./.yarnrc.yml /oada/
COPY ./.yarn /oada/.yarn
# TODO: How to COPY all package.json files with glob?
COPY ./package.json /oada/package.json
COPY ./libs/lib-arangodb/package.json /oada/libs/lib-arangodb/package.json
COPY ./libs/lib-config/package.json /oada/libs/lib-config/package.json
COPY ./libs/lib-kafka/package.json /oada/libs/lib-kafka/package.json
COPY ./libs/pino-debug/package.json /oada/libs/pino-debug/package.json
COPY ./services/auth/package.json /oada/services/auth/package.json
COPY ./services/http-handler/package.json /oada/services/http-handler/package.json
COPY ./services/permissions-handler/package.json /oada/services/permissions-handler/package.json
COPY ./services/rev-graph-update/package.json /oada/services/rev-graph-update/package.json
COPY ./services/shares/package.json /oada/services/shares/package.json
COPY ./services/startup/package.json /oada/services/startup/package.json
COPY ./services/sync-handler/package.json /oada/services/sync-handler/package.json
COPY ./services/users/package.json /oada/services/users/package.json
COPY ./services/webhooks/package.json /oada/services/webhooks/package.json
COPY ./services/well-known/package.json /oada/services/well-known/package.json
COPY ./services/write-handler/package.json /oada/services/write-handler/package.json
RUN yarn workspaces focus --all --production

# Install just production deps
FROM packages AS yarn

# Copy in actual code
COPY . /oada/

# Run again to be safe?
RUN yarn workspaces focus --all --production

# Install all deps and run build step
# Allows for workspaces to have build step (e.g., for TypeScript)
FROM packages AS dev

# Install _all_ dependencies for build
RUN yarn install --immutable

# Copy in actual code
COPY . /oada/

# Run again to be safe?
RUN yarn install --immutable

RUN yarn sdks vscode vim

FROM dev AS build

# Build and then remove yarn stuff
RUN yarn build --verbose && rm -rfv .yarn .pnp.*

FROM node:${NODE_VER} AS code

# Copy in service code and production dependencies
COPY --from=yarn /oada/ /oada/
# Copy in built code
COPY --from=build /oada/ /oada/

# Assemble "production" image
FROM node:$NODE_VER AS production

WORKDIR /oada

# Install needed packages
RUN apk add --no-cache \
  dumb-init

# Copy in entrypoint script
COPY ./utils/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh
RUN chown node:node /entrypoint.sh

# Get wait-for script
ARG WAIT_FOR_VER=v2.2.3
RUN wget https://raw.githubusercontent.com/eficode/wait-for/${WAIT_FOR_VER}/wait-for -O /wait-for
RUN chmod u+x /wait-for
RUN chown node:node /wait-for

# Copy in config file?
COPY ./oada.config.mjs /oada.config.mjs

# Launch entrypoint with dumb-init
# Remap SIGTERM to SIGINT https://github.com/Yelp/dumb-init#signal-rewriting
ENTRYPOINT ["/usr/bin/dumb-init", "--rewrite", "15:2", "--", "/entrypoint.sh"]
# Run start script of package
CMD ["start"]

# Add volume for Binary data and chown to node?
RUN mkdir -p /oada/binary && chown node:node /oada/binary
#VOLUME /oada/binary

# Copy in the code
COPY --from=code /oada/ /oada/

ARG OADA_SERVICE
ENV OADA_SERVICE=${OADA_SERVICE}
ENV INSPECT=

WORKDIR /oada/services/${OADA_SERVICE}

# Do not run services as root
USER node
ENV PORT=8080

FROM production as debug

USER root

COPY --from=dev /oada/ /oada/

# Default to a production target
FROM production