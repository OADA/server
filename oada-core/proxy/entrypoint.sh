#! /bin/sh

# If the SSL certs don't exist for $DOMAIN, nginx won't start. So use the 
# localhost ones and see if that will start it:
if [ -e "/certs/$DOMAIN" ]; then
  echo "Domain certs exist for env DOMAIN=$DOMAIN, moving on to main command"
else
  echo "Domain certs do not exist for env DOMAIN=$DOMAIN, temporarily copying localhost ones there"
  cp -rf /certs/localhost /certs/$DOMAIN
fi

# Additional domains from auth service:
AUTHDOMAINS=`ls /domains`

# Look through each additional domain from auth service and copy localhost cert
# if it doesn't already have a cert:
for d in $AUTHDOMAINS; do
  if [ -e "/certs/$d" ]; then
    echo "Domain certs exist for AUTHDOMAIN=$d, moving on"
  else
    echo "Domain certs do not exist for AUTHDOMAIN=$d, copying localhost ones there"
    cp -rf /certs/localhost /certs/$d
  fi
done

# NOTE: the envsubst command below MUST have single quotes to
# prevent the shell replacing the variables in the string.

# This script will use the DOMAIN variable as well as any domains
# listed at /code/auth/oada-ref-auth-js/public/domains.  

chmod u+x /code/proxy/wait-for-it.sh && \
#  /code/proxy/wait-for-it.sh arangodb:8529 -t 0 && \
#  /code/proxy/wait-for-it.sh zookeeper:2181 -t 0 && \
#  /code/proxy/wait-for-it.sh kafka:9092 -t 0 && \
#  /code/proxy/wait-for-it.sh auth:80 -t 0 && \
#  /code/proxy/wait-for-it.sh well-known:80 -t 0 && \
#  /code/proxy/wait-for-it.sh http-handler:80 -t 0 && \
  mkdir -p /etc/nginx/sites-enabled

  echo "Setting sites-enabled for DOMAIN = ${DOMAIN}"
  envsubst '${DOMAIN}' < /etc/nginx/sites-templates/localhost > /etc/nginx/sites-enabled/${DOMAIN}

  OLDDOMAIN=${DOMAIN}
  for d in $AUTHDOMAINS; do
    DOMAIN=${d}
    echo "Settings sites-enabled for AUTHDOMAIN = ${DOMAIN}"
    envsubst '${DOMAIN}' < /etc/nginx/sites-templates/localhost > /etc/nginx/sites-enabled/${DOMAIN}
  done
  DOMAIN=${OLDDOMAIN}
    
  nginx -g 'daemon off;'
#  nginx-debug -g 'daemon off;'
