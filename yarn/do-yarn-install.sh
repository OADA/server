#!/bin/sh

cd /code/yarn && \
mkdir -p yarn-cache && \
find /code -maxdepth 3 -path *node_modules* -prune -o -name package.json -exec dirname {} \; | \
  xargs -n 1 /code/yarn/do-yarn.sh install
