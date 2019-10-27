#! /bin/bash

if [ "_$1" != "_--force" ]; then
  echo "You have to pass --force here as a reminder that letsencrypt has strict rules "
  echo "for how many times you can request a new certificate set for a domain.  If you "
  echo "already have certs, just run certbot renew, not this command."
  exit
fi

STAGING="--staging"

echo "Asking letsencrypt for new domains..."

# To get new certificates entirely (not just renew, don't forget to remove --staging when done testing):
# If you are adding domains, you need to also do --expand
certbot certonly --expand --webroot --webroot-path /var/www/letsencrypt --agree-tos -m aaron@openag.io --noninteractive --domains $(ls -1 /domains-enabled | sed 's/localhost//' | sed '/^$/d' | tr '\n' ',' | sed 's/,$//')


# THEN you have to symlink /etc/letsencrypt/live/<something>/*.pem to proxy's /certs/<domain>/.
if [ ! -e '/certs/live' ]; then
  echo "certbot failed to create a live directory for some reason, exiting..."
  exit
fi

LETSENCRYPT_CERTNAME=`ls -t /certs/live | head -1`
cd /certs
# the "-t" in ls sorts with most recent on top, and we take that one
for d in $(ls -1 /domains-enabled | sed 's/localhost//'); do
  echo "Symlinking /certs/live/$LETSENCRYPT_CERTNAME to /certs/$d"
  ln -s ./live/$LETSENCRYPT_CERTNAME ./$d
done

echo "To renew these certs, simply use admin to run certbot renew"
echo "YOU MUST RESTART PROXY FOR IT TO SEE ANY CERT CHANGES"

