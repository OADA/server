FROM node:8-alpine

RUN apk add --no-cache bash
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

# Make librdkafka work
ENV WITH_SASL=0
ENV BUILD_LIBRDKAFKA=0
RUN apk add --upgrade --no-cache libressl librdkafka-dev

WORKDIR /code/http-handler

CMD /entrypoint.sh
