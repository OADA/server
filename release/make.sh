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

# Preserve header comment
yq eval '. | ["#", headComment] | join(" ")' $OVERRIDES
echo

# Add comment with version?
echo "# OADA release ${RELEASE_VERSION} compose file ($(date))\n"

# Load config, clean anything potentially not fit for release, merge overrides
docker-compose --env-file=$SCRIPTPATH/.env config --resolve-image-digests | {
    #  Remove build info
    yq eval 'del(.. | select(has("build")).build)' -
} | {
    #  Remove dev volumes?
    yq eval 'del(.. | select(has("volumes")).volumes)' -
} | {
    #  Remove dev environments?
    yq eval 'del(.. | select(has("environment")).environment)' -
} | {
    #  Remove dev ports?
    yq eval 'del(.. | select(has("ports")).ports)' -
} | {
    # Merge in release settings
    yq eval-all \
        '{"x-release": .x-release} * select(fi == 0) * select(fi == 1)' \
        - ${OVERRIDES}
} | {
    # Explode anchors
    # They are technically valid yaml but they were giving me issues
    yq eval 'explode(.)' -
} | {
    # Sort the output by key
    yq eval 'sortKeys(..)' -
}


