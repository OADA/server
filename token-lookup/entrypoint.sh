#! /bin/sh

# Use the same config file as auth to get proper db/collections names
cd /code/token-lookup/oada-srvc-token-lookup && \
  DEBUG="*" npm run start
