#! /bin/sh

chmod u+x /code/token-lookup/wait-for-it.sh && \
  /code/token-lookup/wait-for-it.sh startup:80 -t 0 && \
  cd /code/token-lookup/oada-srvc-token-lookup && \
  npm run start -- --config=/oada-srvc-docker-config.js
