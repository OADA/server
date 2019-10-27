#! /bin/sh

chmod u+x /code/permissions-handler/wait-for-it.sh && \
  /code/permissions-handler/wait-for-it.sh startup:80 -t 0 && \
  cd /code/permissions-handler/oada-srvc-permissions-handler && \
  npm run start -- --config=/oada-srvc-docker-config.js
