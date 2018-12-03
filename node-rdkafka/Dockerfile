FROM node:11

ENV LIBRDKAFKA_VERSION 0.11.5

RUN apt-get -y update \
  && apt-get purge -y libssl-dev \
  && apt-get install -y --no-install-recommends \
    libsasl2-dev \
    libssl-dev \
    libstdc++6 \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/*

RUN curl -Lk -o /root/librdkafka-${LIBRDKAFKA_VERSION}.tar.gz https://github.com/edenhill/librdkafka/archive/v${LIBRDKAFKA_VERSION}.tar.gz \
  && tar -xzf /root/librdkafka-${LIBRDKAFKA_VERSION}.tar.gz -C /root \
  && cd /root/librdkafka-${LIBRDKAFKA_VERSION} \
  && ./configure --prefix /usr \
  && make \
  && make install \
  && make clean \
  && ./configure --disable-lz4 --clean
