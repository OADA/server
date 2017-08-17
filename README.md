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
