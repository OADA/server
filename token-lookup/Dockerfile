FROM mhart/alpine-node:latest

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/token-lookup

CMD /entrypoint.sh
