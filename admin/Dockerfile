FROM ubuntu:latest

RUN apt-get update \
    && apt-get install -y \
               wget git python vim \
               make gcc g++ \
               iputils-ping dnsutils

##################################################################################################
# Configure git:
#RUN git config --global user.email "dev@somebody.com" \
#&& git config --global user.name "dev"

##############################################################################################
# Install arangodb client tools:
RUN wget https://www.arangodb.com/repositories/arangodb31/xUbuntu_16.04/Release.key \
    && apt-key add - < Release.key \
    && echo 'deb https://www.arangodb.com/repositories/arangodb31/xUbuntu_16.04/ /' | tee /etc/apt/sources.list.d/arangodb.list \
    && apt-get install apt-transport-https \
    && apt-get update \
    && apt-get install arangodb3-client=3.1.17

##############################################################################################
# Install kafka zookeeper tools
RUN apt-get install -y kafkacat zookeeper-bin
RUN wget https://github.com/outbrain/zookeepercli/releases/download/v1.0.10/zookeepercli_1.0.10_amd64.deb \
    && dpkg -i zookeepercli_1.0.10_amd64.deb \
    && apt-get install -f \
    && rm zookeepercli_1.0.10_amd64.deb

#############################################################################################
# Install nvm: can't source /root/.bashrc because this stuff all runs in sh
# If you don't set NVM_DIR, then it will install to /bin instead of /root/.nvm
ENV NVM_DIR=/root/.nvm
RUN wget -qO- https://raw.githubusercontent.com/creationix/nvm/v0.30.2/install.sh | bash \
    && . /root/.nvm/nvm.sh \
    && nvm install v7.0 \
    && nvm alias default v7.0
RUN . /root/.nvm/nvm.sh \
    && nvm use v7.0  \
    && npm install -g yarn \
    && yarn global add mocha
    # You can put any global NPM installs here

COPY "./.vimrc" "/root/.vimrc"
COPY "./do-yarn.sh" "/bin/do-yarn.sh"
COPY "./do-yarn-install.sh" "/bin/do-yarn-install.sh"
COPY "./do-yarn-upgrade.sh" "/bin/do-yarn-upgrade.sh"

WORKDIR "/code"
CMD bash
