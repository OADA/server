#! /bin/sh

chmod u+x /code/websockets/wait-for-it.sh && \
  /code/websockets/wait-for-it.sh startup:80 -t 0 && \
  cd /code/websockets/oada-srvc-websockets && \
  DEBUG="*" npm run start -- --config=/oada-srvc-docker-config.js
