#!/bin/sh


find -maxdepth 2 /code -path *node_modules* -prune -o -name package.json -exec dirname {} \; |
  xargs -n 1 do-yarn.sh install
