Install directions
==================

1. `git clone --recurse-submodules ssh://git@github.com/oada/oada-srvc-docker`
2. `cd oada-srvc-docker`
3. `docker-compose build`
4. `docker-compose run --rm admin do-yarn-install.sh`
5. `docker-compose up -d`

Upgrade packages
================
`docker-compose run --rm admin do-yarn-upgrade.sh`
