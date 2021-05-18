FROM linuxserver/swag:version-1.15.0

# Copy in our edited nginx config?
COPY ./nginx.conf /config/nginx/

# Copy our configs in?
COPY ./http.d/*.conf /etc/nginx/http.d/

# Proxy to services
COPY ./proxy-confs/* /config/nginx/proxy-confs/
