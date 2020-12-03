# Dockerfile for oada-core uservices
# Run with context of whole monorepo?
# TODO: Should all this be merged with base?
FROM oada/docker-base-node as build
# Take the service name as build argument
ARG OADA_SERVICE

# Init (partial) monorepo?
COPY ./package.json /oada/
COPY ./yarn.lock /oada/
# TODO: Copy only our code and libs for given service?
COPY ./oada-core/libs /oada/oada-core/libs
COPY ./oada-core/$OADA_SERVICE /oada/oada-core/$OADA_SERVICE
RUN yarn --cwd /oada install --production

FROM oada/docker-base-node
# Take the service name as build argument
ARG OADA_SERVICE
ENV OADA_SERVICE=$OADA_SERVICE

COPY --from=build /oada /oada

# TODO: Shoud these be in / ?
COPY ./oada-core/entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh
COPY ./oada-core/wait-for-it.sh /wait-for-it.sh
RUN chmod u+x /wait-for-it.sh

WORKDIR /oada/oada-core/$OADA_SERVICE

CMD /entrypoint.sh
