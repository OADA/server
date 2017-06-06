#! /bin/bash

echo "Checking if domain is localhost, then running original entrypoint if not"

if [ "$DOMAINS" == "localhost" ]; then
  echo "Domain is localhost, not running original entrypoint"
else
  echo "DOMAIN is not localhost, starting original entrypoint" 
  /opt/certbot/entrypoint.sh
fi
