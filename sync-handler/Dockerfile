FROM node-rdkafka

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR "/code/sync-handler"

CMD /entrypoint.sh
