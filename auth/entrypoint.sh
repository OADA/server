#! /bin/sh

chmod u+x /code/auth/wait-for-it.sh && \
  /code/auth/wait-for-it.sh startup:80 -t 0 && \
  cd /code/auth/oada-ref-auth-js && \
  DEBUG="*" npm run init -- --config=../config.js && \
  DEBUG="*" npm run start -- --config=../config.js

