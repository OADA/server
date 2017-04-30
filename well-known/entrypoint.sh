#! /bin/sh

# Note that the path to the overriding config file must be relative
# to index.js inside the service directory because it will be required
# there.
echo 'Running entrypoint command: cd /code/well-known/oada-srvc-well-known && DEBUG="http/info,http/trace" npm run start -- --config=../config.js'
cd /code/well-known/oada-srvc-well-known && \
  DEBUG="http/info,http/trace" npm run start -- --config=../config.js
