#!/bin/sh

CDIR=`pwd`

echo "----------"
echo $(basename $2)
echo "----------"
cd $2
yarn $1

cd $CDIR
