#! /bin/sh

chmod u+x /code/webhooks/wait-for-it.sh && \
  /code/webhooks/wait-for-it.sh startup:80 -t 0 && \
  cd /code/webhooks/oada-srvc-webhooks && \
  DEBUG="*" npm run start -- --config=/oada-srvc-docker-config.js
