#! /bin/bash

if [ "$#" -ne 1 ]; then
  echo "USAGE: $0 <import directory>";
  exit;
fi

OPTS="--server.authentication false --on-duplicate update --server.database oada --server.endpoint http+tcp://arangodb:8529"

for COL in "resources" "graphNodes" "edges"; do 
  echo "$1/$COL.json"
  arangoimp $OPTS --collection $COL --file $1/$COL.json
done
