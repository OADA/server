#!/bin/bash -i

CDIR=`pwd`

echo "----------"
echo "startup"
echo "----------"
cd /code/startup/oada-srvc-startup
yarn install

echo "----------"
echo "well-known"
echo "----------"
cd /code/well-known/oada-srvc-well-known
yarn install

echo
echo "----"
echo "auth"
echo "----"
cd /code/auth/oada-ref-auth-js
yarn install

echo
echo "------------"
echo "graph-lookup"
echo "------------"
cd /code/graph-lookup/oada-srvc-graph-lookup
yarn install

echo
echo "------------"
echo "token-lookup"
echo "------------"
cd /code/token-lookup/oada-srvc-token-lookup
yarn install

echo
echo "------------"
echo "http-handler"
echo "------------"
cd /code/http-handler/oada-srvc-http-handler
yarn install

echo
echo "-----"
echo "tests"
echo "-----"
cd /code/tests/oada-srvc-tests
yarn install

cd $CDIR
