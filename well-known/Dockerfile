FROM mhart/alpine-node:latest

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/well-known

CMD /entrypoint.sh
