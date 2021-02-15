#! /bin/sh

START="yarn workspace @oada/$OADA_SERVICE start --config=/oada-srvc-docker-config.js"
(expr $OADA_SERVICE = startup || /wait-for-it.sh startup:80 -t 0) && \
    ([ -z "$PINO_TRANSPORT" ] && $START) || $START | $PINO_TRANSPORT
