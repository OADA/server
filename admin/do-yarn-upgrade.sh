#!/bin/bash -i

CDIR=`pwd`

echo "----------"
echo "well-known"
echo "----------"
cd /code/well-known/oada-srvc-well-known
yarn upgrade

echo
echo "----"
echo "auth"
echo "----"
cd /code/auth/oada-ref-auth-js
yarn upgrade

echo
echo "------------"
echo "graph-lookup"
echo "------------"
cd /code/graph-lookup/oada-srvc-graph-lookup
yarn upgrade

echo
echo "------------"
echo "token-lookup"
echo "------------"
cd /code/token-lookup/oada-srvc-token-lookup
yarn upgrade

echo
echo "------------"
echo "http-handler"
echo "------------"
cd /code/http-handler/oada-srvc-http-handler
yarn upgrade

echo
echo "-----"
echo "tests"
echo "-----"
cd /code/tests/oada-srvc-tests
yarn upgrade

cd $CDIR
