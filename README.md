Install directions
==================

1. `git clone ssh://git@github.com/oada/oada-srvc-docker`
2. `cd oada-srvc-docker`
3. `docker-compose build`
4. `docker-compose run yarn`
5. `docker-compose up -d`

Debugging
=========
Set your local DEBUG variable to "*" or some other wildcard and
that will be passed to any services that are restarted.

Multi-domain:
=============
Everything can start up as localhost by default.  If you want to serve multiple
domains, create the appropriate folder (same name as hostname) in /domains.  
The proxy will see it and create domain configs for each name there, and the
auth service will use that info to serve the proper logo, name, etc. for each
service.
