---
to: <%= name %>/Dockerfile
---
FROM node:13

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/<%= name %>

CMD '/entrypoint.sh'
