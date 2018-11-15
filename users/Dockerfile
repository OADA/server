FROM mhart/alpine-node:8.7

RUN apk add --no-cache bash
COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

# Make librdkafka work
ENV WITH_SASL=0
ENV BUILD_LIBRDKAFKA=0
RUN apk add --upgrade --no-cache \
    libressl --repository http://dl-3.alpinelinux.org/alpine/edge/main/ --allow-untrusted \
    librdkafka-dev --repository http://dl-3.alpinelinux.org/alpine/edge/community/ --allow-untrusted

WORKDIR "/code/users"

CMD /entrypoint.sh
