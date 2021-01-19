FROM oada/docker-base-node

COPY ./entrypoint.sh /entrypoint.sh
RUN chmod u+x /entrypoint.sh

WORKDIR /code/tests
# ----------------

# -----------------------------
# Ubuntu with nodejs and docker
# -----------------------------
# FROM ubuntu:14.04
#
# COPY ./entrypoint.sh /entrypoint.sh
# RUN chmod u+x /entrypoint.sh
#
# WORKDIR /code/tests
#
# RUN apt-get update
#
# # Install Node.js
# RUN apt-get -qq install --yes curl
# RUN curl --silent --location https://deb.nodesource.com/setup_4.x | sudo bash -
# RUN apt-get -qq install --yes nodejs
#
# # Install docker
# RUN apt-get -qq install --yes docker.io
# -----------------------------

CMD /entrypoint.sh
