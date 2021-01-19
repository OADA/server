FROM library/nginx

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/proxy

CMD /entrypoint.sh
