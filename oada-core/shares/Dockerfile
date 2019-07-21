FROM oada/docker-base-node

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR "/code/shares"

CMD /entrypoint.sh
