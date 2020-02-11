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
COMMAND="ls -1 /domains-enabled | sed 's/localhost//' "
for i in $(ls -1 /domains-enabled); do
  if [ -e "/domains-enabled/$i/certs" ]; then
    echo "Domain $i has a certs folder for a manual cert, removing it from the list of Lets Encrypt domains"
    COMMAND="${COMMAND} | sed s'/$i//' "
  else
    echo "Domain $i does not have a certs folder, including it in the list to request certs from LetsEncrypt"
  fi
done
# Now eliminate empty lines
COMMAND="${COMMAND}| sed '/^$/d' | tr '\n' ',' | sed 's/,$//'"
# Eval the command to get the list of valid domains w/o certs, one per line:
DOMAINS=$(eval $COMMAND)

# For certbot list, join with commas, strip trailing comma:
COMMA_SEPARATED_DOMAINS_COMMAND="${COMMAND} | tr '\n' ',' | sed 's/,$//'"
COMMA_SEPARATED_DOMAINS=$(eval $COMMA_SEPARATED_DOMAINS_COMMAND)
echo "Final domains list for lets encrypt cert is: $COMMA_SEPARATED_DOMAINS"
echo "-----------"

# Now run the actual certbot command:
echo "certbot certonly --expand --webroot --webroot-path /var/www/letsencrypt --agree-tos -m aaron@openag.io --noninteractive --domains $COMMA_SEPARATED_DOMAINS"
certbot certonly --expand --webroot --webroot-path /var/www/letsencrypt --agree-tos -m aaron@openag.io --noninteractive --domains $COMMA_SEPARATED_DOMAINS

# THEN you have to symlink /etc/letsencrypt/live/<something>/*.pem to proxy's /certs/<domain>/.
if [ ! -e '/certs/live' ]; then
  echo "certbot failed to create a live directory for some reason, exiting..."
  exit
fi

# Uses the "latest" file in the certs folder, but not README
LETSENCRYPT_CERTNAME=`ls -t /certs/live | sed '/^\s*README\s*$/d' | head -1`
cd /certs
# the "-t" in ls sorts with most recent on top, and we take that one
for d in $DOMAINS; do
  echo "Symlinking /certs/live/$LETSENCRYPT_CERTNAME to /certs/$d"
  ln -s ./live/$LETSENCRYPT_CERTNAME ./$d
done

echo "To renew these certs, simply use admin to run certbot renew"
echo "YOU MUST RESTART PROXY FOR IT TO SEE ANY CERT CHANGES"

