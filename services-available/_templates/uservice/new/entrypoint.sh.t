---
to: <%= name %>/entrypoint.sh
---
#! /bin/bash

SERVICE_ROOT="/code/<%= name %>"

chmod u+x ${SERVICE_ROOT}/wait-for-it.sh && \
  ${SERVICE_ROOT}/wait-for-it.sh startup:80 -t 0 && \
  cd ${SERVICE_ROOT}

if [ -z ${DEBUG+x} ]; then export DEBUG="*"; fi

if [[ ! -d "node_modules" ]]; then
  echo "${SERVICE_ROOT}: yarn install"
  yarn install
fi

echo "npm run start -- --config=\"/oada-srvc-docker-config.js\""
npm run start -- --config=/oada-srvc-docker-config.js
