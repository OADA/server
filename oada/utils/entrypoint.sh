#! /bin/sh

# Use yarn workspace as "entry point"
CMD="yarn workspace @oada/${OADA_SERVICE} run $@"

# Wait for startup, then run CMD.
(expr ${OADA_SERVICE} = startup || /wait-for-it.sh startup:8080 -s -t 0) &&
    if [ ! -t 1 ] && [ -n "${PINO_TRANSPORT}" ];
    then
        # Only pipe if PINO_TRANSPORT set and non-interactive
        ${CMD} | ${PINO_TRANSPORT};
    else
        # Interactive or no transport set?
        ${CMD};
    fi
