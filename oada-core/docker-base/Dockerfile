FROM node:14

# node-rdkafka requires these things to be installed:
RUN apt-get update -y && \
  apt-get install -y --no-install-recommends gcc zlibc libc6-dev bash g++  ca-certificates  liblz4-dev  musl-dev   libsasl2-dev   libssl-dev   make   python && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

CMD [ "node" ]

