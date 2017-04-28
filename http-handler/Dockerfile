FROM mhart/alpine-node:latest

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/http-handler

CMD /entrypoint.sh
