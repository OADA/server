FROM andthensome/alpine-node-bash:latest

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/well-known

CMD /entrypoint.sh
