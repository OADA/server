#! /bin/bash

cd /code/auth/oada-ref-auth-js && \
  DEBUG="init,arango/init" npm run init -- --config=../config.js

