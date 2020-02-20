FROM oada/docker-base-node

# Need newer yarn
RUN yarn global add yarn

COPY "./do-yarn.sh" "/bin/do-yarn.sh"
COPY "./do-yarn-install.sh" "/bin/do-yarn-install.sh"
COPY "./do-yarn-upgrade.sh" "/bin/do-yarn-upgrade.sh"

WORKDIR "/code/yarn"
CMD /code/yarn/do-yarn-install.sh
