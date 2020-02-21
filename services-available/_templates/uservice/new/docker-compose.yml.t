---
to: <%= name %>/docker-compose.yml
---
version: "3"

services:
  ##########################################
  # Overrides for oada-core services:
  ##########################################

  # Add ourselves to yarn to do yarn install
  yarn:
    volumes:
      - ./services-available/<%= name %>:/code/<%= name %>

  # Add ourselves to admin container:
  admin:
    volumes:
      - ./services-available/<%= name %>:/code/<%= name %>


  ###############################################
  # This service's definition:
  ###############################################
  <%= name %>:
    depends_on:
      - startup
    build:
      context: ./services-available/<%= name %>
    container_name: <%= name %>
    restart: always
    networks:
      - http_net
      - startup_net
      - arango_net
    volumes:
      - ./services-available/<%= name %>:/code/<%= name %>
      - ./oada-core/libs:/code/libs
      - ./oada-srvc-docker-config.js:/oada-srvc-docker-config.js
    environment:
      - NODE_TLS_REJECT_UNAUTHORIZED
      - NODE_ENV=${NODE_ENV:-development}
      - DEBUG
