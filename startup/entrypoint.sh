#! /bin/sh

chmod u+x /code/startup/wait-for-it.sh && \
  /code/startup/wait-for-it.sh arangodb:8529 -t 0 && \
  /code/startup/wait-for-it.sh zookeeper:2181 -t 0 && \
  /code/startup/wait-for-it.sh kafka:9092 -t 0 && \
  cd /code/startup/oada-srvc-startup && \
  npm run start
