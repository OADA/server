#! /bin/sh

chmod u+x /code/auth/wait-for-it.sh && \
  /code/auth/wait-for-it.sh startup:80 -t 0 && \
  cd /code/auth/oada-ref-auth-js
if [ -z ${DEBUG+x} ]; then export DEBUG="*"; fi
exec npm run start -- --config=/oada-srvc-docker-config.js

