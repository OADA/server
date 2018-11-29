FROM node:8-alpine

# Make librdkafka work
ENV WITH_SASL=0
ENV BUILD_LIBRDKAFKA=0
RUN apk --no-cache add \                                                         
  bash \                                                                     
  g++ \                                                                      
  ca-certificates \                                                          
  lz4-dev \                                                                  
  musl-dev \                                                                 
  cyrus-sasl-dev \                                                           
  openssl-dev \                                                              
  make \                                                                     
  python                                                                     
RUN apk add --no-cache --virtual .gyp python make g++ gcc zlib-dev libc-dev bsd-compat-headers py-setuptools bash
RUN apk add --upgrade --no-cache libressl librdkafka-dev 

# NPM 5.8 was missing gyp
#RUN cd /usr/lib/node_modules/npm && npm install node-gyp

COPY "./do-yarn.sh" "/bin/do-yarn.sh"
COPY "./do-yarn-install.sh" "/bin/do-yarn-install.sh"
COPY "./do-yarn-upgrade.sh" "/bin/do-yarn-upgrade.sh"

WORKDIR "/code/yarn"
CMD /code/yarn/do-yarn-install.sh
