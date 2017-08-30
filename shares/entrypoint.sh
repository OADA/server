#! /bin/sh

chmod u+x /code/shares/wait-for-it.sh && \
  /code/shares/wait-for-it.sh startup:80 -t 0 && \
  cd /code/shares/oada-srvc-shares && \
  DEBUG="*" npm run start -- --config=/oada-srvc-docker-config.js
