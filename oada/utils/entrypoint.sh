#! /bin/sh

# Use yarn workspace as "entry point"
CMD="corepack yarn workspace @oada/${OADA_SERVICE} run $*"

# Wait for startup, then run CMD.
([ "${OADA_SERVICE}" = "startup" ] || /wait-for startup:8080 -q -t 0) &&
  if [ ! -t 1 ] && [ -n "${PINO_TRANSPORT}" ]; then
    # Only pipe if PINO_TRANSPORT set and non-interactive
    FIFO=/tmp/pino-fifo
    rm -f "${FIFO}"
    mkfifo "${FIFO}"
    ${PINO_TRANSPORT} <"${FIFO}" &
    exec ${CMD} >"${FIFO}"
  else
    # Interactive or no transport set?
    exec ${CMD}
  fi