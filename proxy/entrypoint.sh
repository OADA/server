#! /bin/sh

chmod u+x /code/proxy/wait-for-it.sh && \
  /code/proxy/wait-for-it.sh arangodb:8529 -t 0 && \
  /code/proxy/wait-for-it.sh zookeeper:2181 -t 0 && \
  /code/proxy/wait-for-it.sh kafka:9092 -t 0 && \
  /code/proxy/wait-for-it.sh auth:80 -t 0 && \
  /code/proxy/wait-for-it.sh well-known:80 -t 0 && \
  /code/proxy/wait-for-it.sh http-handler:80 -t 0 && \
  nginx-debug -g 'daemon off;'
