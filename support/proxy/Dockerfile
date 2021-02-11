FROM library/nginx

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

COPY nginx.conf /etc/nginx/nginx.conf

WORKDIR /code/proxy

CMD /entrypoint.sh
