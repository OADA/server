#! /bin/sh

chmod u+x /code/indexer/wait-for-it.sh && \
  /code/indexer/wait-for-it.sh startup:80 -t 0 && \
  cd /code/indexer/oada-srvc-indexer && \
  npm run start -- --config=/oada-srvc-docker-config.js
