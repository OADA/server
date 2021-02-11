FROM node:14-slim AS install

WORKDIR /oada

# node-rdkafka requires these things to be installed:
RUN apt-get update -y && apt-get install -y --no-install-recommends \
    zlibc \
    libc6 \
    liblz4-1 \
    libsasl2-2 \
    libssl1.1 \
    ca-certificates \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

FROM install AS build

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

# TODO: How to COPY all package.json files?
#COPY **/package.json yarn.lock .yarnrc.yml /oada/
#COPY .yarn/ /oada/.yarn/
COPY . /oada/

RUN yarn workspaces focus --all --production

FROM install

COPY ./utils/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

COPY ./utils/wait-for-it.sh /wait-for-it.sh
RUN chmod u+x /wait-for-it.sh

COPY --from=build /oada/ /oada/
#COPY . /oada/

ARG OADA_SERVICE
ENV OADA_SERVICE=${OADA_SERVICE}

WORKDIR /oada/services/${OADA_SERVICE}

CMD /entrypoint.sh

