#! /bin/sh

CMD="yarn workspace @oada/${OADA_SERVICE} run $@"
(expr ${OADA_SERVICE} = startup || /wait-for-it.sh startup:80 -t 0) && \
    ([ -z "${PINO_TRANSPORT}" ] && ${CMD}) || ${CMD} | ${PINO_TRANSPORT}
