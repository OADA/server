echo "This script will forward port 8529 on arangodb to 8529 on admin container using socat"
echo "DO NOT FORGET that you have to start admin with -p8529:8529 option like:"
echo "oada run --rm -p8529:8529 admin"
echo "ALSO DO NOT RUN THIS IN PRODUCTION.  USE SSH INSTEAD.  Like this:"
echo "ssh -Llocalhost:8529:<ip of arangodb container on remote machine>:8529 user@remote"
socat tcp-listen:8529,reuseaddr,fork tcp:arangodb:8529
