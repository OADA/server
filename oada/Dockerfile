FROM node:14-buster-slim AS install

WORKDIR /oada

# node-rdkafka requires these things to be installed:
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    ca-certificates \
    libc6 \
    liblz4-1 \
    libsasl2-2 \
    libssl1.1 \
    tini \
    zlibc \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

FROM install AS packages

# install things only needed for build?
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    gcc \
    git \
    libc6-dev \
    g++ \
    liblz4-dev \
    musl-dev \
    libsasl2-dev \
    libssl-dev \
    make \
    python \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

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
COPY ./services/graph-lookup/package.json /oada/services/graph-lookup/package.json
COPY ./services/http-handler/package.json /oada/services/http-handler/package.json
COPY ./services/permissions-handler/package.json /oada/services/permissions-handler/package.json
COPY ./services/rev-graph-update/package.json /oada/services/rev-graph-update/package.json
COPY ./services/shares/package.json /oada/services/shares/package.json
COPY ./services/startup/package.json /oada/services/startup/package.json
COPY ./services/sync-handler/package.json /oada/services/sync-handler/package.json
COPY ./services/token-lookup/package.json /oada/services/token-lookup/package.json
COPY ./services/users/package.json /oada/services/users/package.json
COPY ./services/webhooks/package.json /oada/services/webhooks/package.json
COPY ./services/well-known/package.json /oada/services/well-known/package.json
COPY ./services/write-handler/package.json /oada/services/write-handler/package.json
RUN yarn workspaces focus --all --production

FROM packages AS yarn

# Copy in actual code
COPY . /oada/

# Run again to be safe?
RUN yarn workspaces focus --all --production

# Allow for workspaces to have build step (e.g., for TypeScript)
FROM packages as build

# Install _all_ dependencies for build
RUN yarn install --immutable

# Copy in actual code
COPY . /oada/

# Run again to be safe?
RUN yarn install --immutable

# Build and then remove yarn stuff??
RUN yarn workspaces foreach run build && rm -rf .yarn .pnp.*

FROM install

COPY ./utils/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

COPY ./utils/wait-for-it.sh /wait-for-it.sh
RUN chmod u+x /wait-for-it.sh

# Copy in service code and production dependencies
COPY --from=yarn /oada/ /oada/
# Copy in built code
# TODO: Don't have both source and built code in image?
COPY --from=build /oada/ /oada/

# Copy in config file?
COPY ./oada-srvc-docker-config.js /oada-srvc-docker-config.js

# Launch entrypoint with tini
ENTRYPOINT ["/usr/bin/tini", "--", "/entrypoint.sh"]
# Run start script of package
CMD ["start", "--config=/oada-srvc-docker-config.js"]

ARG OADA_SERVICE
ENV OADA_SERVICE=${OADA_SERVICE}

# Do not run services as root
USER node

WORKDIR /oada/services/${OADA_SERVICE}

