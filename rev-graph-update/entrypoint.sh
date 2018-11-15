#! /bin/sh

chmod u+x /code/rev-graph-update/wait-for-it.sh && \
  /code/rev-graph-update/wait-for-it.sh startup:80 -t 0 && \
  cd /code/rev-graph-update/oada-srvc-rev-graph-update && \
  npm run start -- --config=/oada-srvc-docker-config.js
