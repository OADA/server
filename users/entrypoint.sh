#! /bin/sh

chmod u+x /code/users/wait-for-it.sh && \
  /code/users/wait-for-it.sh startup:80 -t 0 && \
  cd /code/users/oada-srvc-users && \
  npm run start -- --config=/oada-srvc-docker-config.js
