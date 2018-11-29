#FROM mhart/alpine-node:latest
FROM node:8-alpine
RUN apk --no-cache add \
      bash \
      g++ \
      ca-certificates \
      lz4-dev \
      musl-dev \
      cyrus-sasl-dev \
      openssl-dev \
      make \
      python

RUN apk add --no-cache --virtual .gyp python make g++ gcc zlib-dev libc-dev bsd-compat-headers py-setuptools bash

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

# Make librdkafka work
ENV WITH_SASL=0
ENV BUILD_LIBRDKAFKA=0
RUN apk add --upgrade --no-cache libressl librdkafka-dev

WORKDIR "/code/webhooks"

CMD /entrypoint.sh
