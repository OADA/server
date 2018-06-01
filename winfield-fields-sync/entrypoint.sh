#! /bin/sh

chmod u+x /code/winfield-fields-synv/wait-for-it.sh && \
  /code/winfield-fields-sync/wait-for-it.sh startup:80 -t 0 && \
  cd /code/winfield-fields-sync/oada-srvc-winfield-fields-sync && \
  npm run start -- --config=/oada-srvc-docker-config.js
