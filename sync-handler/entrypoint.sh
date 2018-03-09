#! /bin/sh

chmod u+x /code/sync-handler/wait-for-it.sh && \
  /code/sync-handler/wait-for-it.sh startup:80 -t 0 && \
  cd /code/sync-handler/oada-srvc-sync-handler && \
  npm run start -- --config=/oada-srvc-docker-config.js
