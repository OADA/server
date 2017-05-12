#! /bin/sh

chmod u+x /code/http-handler/wait-for-it.sh && \
  /code/http-handler/wait-for-it.sh startup:80 -t 0 && \
  cd /code/http-handler/oada-srvc-http-handler && \
  npm run start
