FROM linuxserver/swag

# Copy our configs in?
COPY ./conf.d/* /etc/nginx/conf.d/

# Proxy to services
COPY ./proxy-confs/* /config/nginx/proxy-confs/
