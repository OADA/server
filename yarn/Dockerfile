FROM mhart/alpine-node:latest

# Make librdkafka work
ENV WITH_SASL=0
ENV BUILD_LIBRDKAFKA=0
RUN apk add --upgrade --no-cache \
    libressl --repository http://dl-3.alpinelinux.org/alpine/edge/main/ --allow-untrusted \
    librdkafka-dev --repository http://dl-3.alpinelinux.org/alpine/edge/community/ --allow-untrusted

# Support compiling native dependencies
RUN apk add --no-cache bash
RUN apk add --no-cache --virtual .gyp python make g++

# NPM 5.8 was missing gyp
#RUN cd /usr/lib/node_modules/npm && npm install node-gyp

COPY "./do-yarn.sh" "/bin/do-yarn.sh"
COPY "./do-yarn-install.sh" "/bin/do-yarn-install.sh"
COPY "./do-yarn-upgrade.sh" "/bin/do-yarn-upgrade.sh"

WORKDIR "/code/yarn"
CMD /code/yarn/do-yarn-install.sh
