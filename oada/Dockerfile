FROM node:14-slim

# node-rdkafka requires these things to be installed:
RUN apt-get update -y && \
  apt-get install -y --no-install-recommends gcc zlibc libc6-dev bash g++  ca-certificates  liblz4-dev  musl-dev   libsasl2-dev   libssl-dev   make   python && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

COPY ./utils/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

COPY ./utils/wait-for-it.sh /wait-for-it.sh
RUN chmod u+x /wait-for-it.sh

COPY . /oada/
RUN yarn --cwd /oada install --production

ARG OADA_SERVICE
ENV OADA_SERVICE=${OADA_SERVICE}

WORKDIR /oada/${OADA_SERVICE}

CMD /entrypoint.sh

