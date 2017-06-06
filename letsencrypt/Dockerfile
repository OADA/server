FROM gordonchan/auto-letsencrypt 

WORKDIR "/"

COPY ./entrypoint.sh /testlocalhost-entrypoint.sh
RUN chmod 700 /testlocalhost-entrypoint.sh

ENTRYPOINT []
CMD /testlocalhost-entrypoint.sh

