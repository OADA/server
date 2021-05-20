ARG NODE_VER=16-alpine

# Copy in package files and any needed apt packages?
FROM node:$NODE_VER AS packages

WORKDIR /oada

# Need to list out every package.json we need from monorepo for caching stuff...
COPY ./yarn.lock ./.yarnrc.yml /oada/
COPY ./.yarn /oada/.yarn
# TODO: How to COPY all package.json files with glob?
COPY ./package.json /oada/package.json
COPY ./libs/oada-lib-arangodb/package.json /oada/libs/oada-lib-arangodb/package.json
COPY ./libs/oada-lib-config/package.json /oada/libs/oada-lib-config/package.json
COPY ./libs/oada-lib-kafka/package.json /oada/libs/oada-lib-kafka/package.json
COPY ./libs/oada-pino-debug/package.json /oada/libs/oada-pino-debug/package.json
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
FROM packages as build

# Install _all_ dependencies for build
RUN yarn install --immutable

# Copy in actual code
COPY . /oada/

# Run again to be safe?
RUN yarn install --immutable

# Build and then remove yarn stuff
# TODO: Without p it quits after first build... ?
RUN yarn build -p --verbose && rm -rfv .yarn .pnp.*

FROM node:$NODE_VER AS code

# Copy in service code and production dependencies
COPY --from=yarn /oada/ /oada/
# Copy in built code
COPY --from=build /oada/ /oada/

# Remove uncompiled code (e.g. TS files, C/C++ of librdkafka)?
SHELL ["/bin/ash", "-c"]
RUN find /oada -name src | xargs rm -rfv


# Assemble "production" image
FROM node:$NODE_VER AS production

WORKDIR /oada

# Install packages needed for running node-rdkafka etc.
RUN apk add --no-cache \
    bash \
    tini

COPY ./utils/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

COPY ./utils/wait-for-it.sh /wait-for-it.sh
RUN chmod u+x /wait-for-it.sh

# Copy in config file?
COPY ./oada.config.js /oada.config.js

# Launch entrypoint with tini
ENTRYPOINT ["/sbin/tini", "--", "/entrypoint.sh"]
# Run start script of package
CMD ["start"]

# Copy in the code
COPY --from=code /oada/ /oada/

# Add volume for Binary data and chown to node?
RUN mkdir -p /oada/binary && chown node:node /oada/binary
#VOLUME /oada/binary

# Do not run services as root
USER node

ARG OADA_SERVICE
ENV OADA_SERVICE=${OADA_SERVICE}

WORKDIR /oada/services/${OADA_SERVICE}

