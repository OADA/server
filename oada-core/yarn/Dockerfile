FROM oada/docker-base-node

ENV BUILD_LIBRDKAFKA=0

COPY "./do-yarn.sh" "/bin/do-yarn.sh"
COPY "./do-yarn-install.sh" "/bin/do-yarn-install.sh"
COPY "./do-yarn-upgrade.sh" "/bin/do-yarn-upgrade.sh"

WORKDIR "/code/yarn"
CMD /bin/bash #/code/yarn/do-yarn-install.sh
