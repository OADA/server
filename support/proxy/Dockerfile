FROM scratch as configs

# Copy in our edited nginx config?
COPY ./nginx.conf /config/nginx/

# Copy our configs in?
COPY ./http.d/*.conf /etc/nginx/http.d/

# Proxy to services
COPY ./proxy-confs/* /config/nginx/proxy-confs/

FROM linuxserver/nginx:1.20.2 as http-only

ENV DOCKER_MODS=linuxserver/mods:nginx-proxy-confs

COPY --from=configs / /

# Disable https
COPY ./default /config/nginx/site-confs/

FROM linuxserver/swag:version-1.15.0 as https

COPY --from=configs / /