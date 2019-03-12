#!/bin/sh

CDIR=`pwd`

echo "----------"
# if [ ! -f $2/../do-not-run-yarn.* ]; then
# exit
# fi
echo "cd $2 && yarn $1"
echo "----------"
cd $2 && yarn --cache-folder /code/yarn/yarn-cache $1

cd $CDIR
