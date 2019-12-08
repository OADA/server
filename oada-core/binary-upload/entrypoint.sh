#! /bin/sh

# Note that the path to the overriding config file must be relative
# to index.js inside the service directory because it will be required
# there.
cd /code/binary-upload/oada-srvc-binary-upload && \
  npm run start -- --config=/oada-srvc-docker-config.js
