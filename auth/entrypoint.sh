#! /bin/sh

chmod u+x /code/auth/wait-for-it.sh && \
  /code/auth/wait-for-it.sh startup:80 -t 0 && \
  cd /code/auth/oada-ref-auth-js
export DEBUG="*"   
exec npm run start -- --config=/oada-srvc-docker-config.js

