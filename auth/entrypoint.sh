#! /bin/sh

cd /code/auth/oada-ref-auth-js && \
  DEBUG="*" npm run init -- --config=../config.js && \
  DEBUG="*" npm run start -- --config=../config.js

