#!/bin/sh

# Find directory where this file is
SCRIPT=$(readlink -f "$0")
SCRIPTPATH=$(dirname "${SCRIPT}")

OVERRIDES=${SCRIPTPATH}/docker-compose.override.yml

if [ -z "${RELEASE_VERSION}" ]; then
  RELEASE_VERSION=${OADA_VERSION}
fi

# Pull desired version of images
docker-compose pull

# Add comment with version?
echo "# OADA release ${RELEASE_VERSION} compose file ($(date))\n"

# Load config, clean anything potentially not fit for release, merge overrides
docker-compose \
  --env-file="${SCRIPTPATH}/.env" \
  -f "${SCRIPTPATH}/../docker-compose.yml" \
  -f "${OVERRIDES}" \
  config --resolve-image-digests | {
  #  Remove build info
  yq 'del(.. | select(has("build")).build)'
} | {
  #  Remove dev volumes?
  yq 'del(.. | select(has("volumes")).volumes)'
} | {
  #  Remove dev environments?
  yq 'del(.. | select(has("environment")).environment)'
} | {
  #  Remove dev ports?
  yq 'del(.. | select(has("ports")).ports)'
} | {
  #  Remove name
  yq 'del(.name)'
} | {
  # Merge in release settings
  yq "load(\"${OVERRIDES}\") *n ."
} | {
  # Explode anchors
  # They are technically valid yaml but they were giving me issues
  yq 'explode(.)'
} | {
  #  Remove x-release
  yq 'del(.x-release)'
} | {
  # Sort the output by key
  yq 'sortKeys(..)'
} | {
  # Allow pulling our images by tag OADA_VERSION, or default to this digest
  sed "s/image: oada\/\(.*\)\(@.*\)/image: oada\/\1:\${OADA_VERSION:-${OADA_VERSION}\2}/"
}
