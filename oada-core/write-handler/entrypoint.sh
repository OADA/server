#! /bin/sh

chmod u+x /code/write-handler/wait-for-it.sh && \
  /code/write-handler/wait-for-it.sh startup:80 -t 0 && \
  cd /code/write-handler/oada-srvc-write-handler && \
  npm run start -- --config=/oada-srvc-docker-config.js
