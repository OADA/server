#! /bin/sh

(expr $OADA_SERVICE = startup || /wait-for-it.sh startup:80 -t 0) && \
  yarn --cwd /oada workspace @oada/$OADA_SERVICE start --config=/oada-srvc-docker-config.js
