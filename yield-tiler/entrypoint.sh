#! /bin/sh

chmod u+x /code/yield-tiler/wait-for-it.sh && \
  /code/yield-tiler/wait-for-it.sh startup:80 -t 0 && \
  cd /code/yield-tiler/oada-srvc-yield-tiler && \
  npm run start -- --config=/oada-srvc-docker-config.js
