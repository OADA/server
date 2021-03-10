#! /bin/sh

CMD="yarn workspace @oada/${OADA_SERVICE} run $@"
(expr ${OADA_SERVICE} = startup || /wait-for-it.sh startup:8080 -s -t 0) &&
    if [ -z "${PINO_TRANSPORT}" ];
    then
        ${CMD};
    else
        ${CMD} | ${PINO_TRANSPORT};
    fi
