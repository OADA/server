#! /bin/sh

cd /code/auth/oada-ref-auth-js && \
  DEBUG="init,arango/init,err" npm run init -- --config=../config.js && \
  DEBUG="info,error" npm run start -- --config=../config.js

