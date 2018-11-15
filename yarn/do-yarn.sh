#!/bin/sh

CDIR=`pwd`

echo "----------"
echo "cd $2 && yarn $1"
echo "----------"
cd $2 && yarn --cache-folder /code/yarn/yarn-cache $1

cd $CDIR
