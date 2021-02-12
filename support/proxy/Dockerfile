FROM library/nginx

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

COPY nginx.conf /etc/nginx/nginx.conf

COPY . /code/proxy/
WORKDIR /code/proxy

CMD /entrypoint.sh
