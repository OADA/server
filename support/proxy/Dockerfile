FROM linuxserver/swag

# Use latest stable NGINX
RUN apk upgrade \
    --no-cache \
    --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main \
    nginx*

# Copy our configs in?
COPY ./conf.d/* /etc/nginx/conf.d/

# Proxy to services
COPY ./proxy-confs/* /config/nginx/proxy-confs/
