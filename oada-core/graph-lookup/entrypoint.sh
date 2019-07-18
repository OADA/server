#! /bin/sh

chmod u+x /code/graph-lookup/wait-for-it.sh && \
  /code/graph-lookup/wait-for-it.sh startup:80 -t 0 && \
  cd /code/graph-lookup/oada-srvc-graph-lookup && \
  npm run start -- --config=/oada-srvc-docker-config.js
