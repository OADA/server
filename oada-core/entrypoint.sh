#! /bin/sh

(expr $OADA_SERVICE = startup || /wait-for-it.sh startup:80 -t 0) && \
  cd /oada/oada-core/$OADA_SERVICE/oada-srvc-$OADA_SERVICE && \
  yarn start -- --config=/oada-srvc-docker-config.js
