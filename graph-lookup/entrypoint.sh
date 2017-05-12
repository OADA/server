#! /bin/sh

cd /code/graph-lookup/oada-srvc-graph-lookup && \
  npm i
  npm run start -- --config=../config.js
