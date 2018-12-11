FROM oada/node-rdkafka

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/auth

CMD ['/entrypoint.sh']
