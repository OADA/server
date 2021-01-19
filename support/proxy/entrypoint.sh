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
AUTHDOMAINS=`ls /domains-enabled`

# Look through each additional domain from auth service and copy localhost cert
# if it doesn't already have a cert:
for d in $AUTHDOMAINS; do

  if [ -e "/certs/$d" ]; then
    echo "Domain certs exist for AUTHDOMAIN=$d, moving on.  To really, really replace a cert, you must login to admin and remove /certs/$d manually.  Careful to unlink symlinks instead of rm."

  elif [ -e "/domains-enabled/$d/certs" ]; then
    echo "No certs exist at /certs/$d, but manual /domains-enabled/$d/certs folder exists.  Symlinking each folder in $d/certs/ to same name at /certs"
    for i in `ls /domains-enabled/$d/certs`; do
      # Don't get confused between $d (name of folder under domains-enabled/) and $i (name of folder under domains-enabled/$d/certs)
      # We're just faithfully adding links to everything in the domain's certs/ folder to the root certs/ folder
      if [ -e "/certs/$i" ]; then
        echo "/certs/$i already exists, NOT symlinking it again from /domains-enabled/$d/certs/$i.  To force, exec into proxy container and unlink /certs/$i"
      else
        echo "Creating symlink at /certs/$i to /domains-enabled/$d/certs/$i"
        ln -s /domains-enabled/$d/certs/$i /certs/$i
      fi
    done

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
    if [ -e "/domains-enabled/$d/sites-enabled" ]; then
      echo "Domain $d has a manual sites-enabled, symlinking that into nginx instead of using default from localhost"
      for i in `ls /domains-enabled/$d/sites-enabled`; do
        if [ -e "/etc/nginx/sites-enabled/$i" ]; then
          echo "/etc/nginx/sites-enabled/$i already exists, NOT re-symlinking from /domains-enabled/$d/sites-enabled/$i.  To force, exec into proxy and unlink /etc/nginx/sites-enabled/$i"
        else
          echo "Symlinking /domains-enabled/$d/sites-enabled/$i into /etc/nginx/sites-enabled/$i"
          ln -s /domains-enabled/$d/sites-enabled/$i /etc/nginx/sites-enabled/$i
        fi
      done
    else 
      echo "Domain $d has no manual sites-enabled, replacing DOMAIN in localhost one as default"
      DOMAIN=${d}
      echo "Settings sites-enabled for AUTHDOMAIN = ${DOMAIN}"
      envsubst '${DOMAIN}' < /etc/nginx/sites-templates/localhost > /etc/nginx/sites-enabled/${DOMAIN}
    fi
  done
  DOMAIN=${OLDDOMAIN}
    
  nginx -g 'daemon off;'
#  nginx-debug -g 'daemon off;'
