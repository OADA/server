#!/bin/sh


find /code -maxdepth 3 -path *node_modules* -prune -o -name package.json -exec dirname {} \; |
  xargs -n 1 do-yarn.sh install
