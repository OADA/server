FROM node:11.15
# Note: librdkafka will not build with 12.0 onwards because v8's ToString method is deprecated

# node-rdkafka requires these things to be installed:
RUN apt-get update -y && \
  apt-get install -y --no-install-recommends gcc zlibc libc6-dev bash g++  ca-certificates  liblz4-dev  musl-dev   libsasl2-dev   libssl-dev   make   python && \
  apt-get clean && rm -rf /var/lib/apt/lists/*

# now install a global librdkafka:
#ENV LIBRDKAFKA_VERSION="0.11.6"
#RUN curl -Lk -o /root/librdkafka-${LIBRDKAFKA_VERSION}.tar.gz https://github.com/edenhill/librdkafka/archive/v${LIBRDKAFKA_VERSION}.tar.gz \
  #  && tar -xzf /root/librdkafka-${LIBRDKAFKA_VERSION}.tar.gz -C /root
#RUN cd /root/librdkafka-${LIBRDKAFKA_VERSION} \
  #  && ./configure --prefix /usr \
  # && make   && make install   && make clean

CMD [ "node" ]

