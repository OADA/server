# OADA Reference API Server

[![CodeFactor](https://www.codefactor.io/repository/github/OADA/server)](https://www.codefactor.io/repository/github/OADA/server)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier)
[![License](https://img.shields.io/github/license/OADA/server)](LICENSE)


This project is a reference implementation of an OADA-conformant API server.
It can be used to host easily run your own OADA instance,
or for comparison when creating an OADA-conformant API implementation.

The repository and releases come with configurations for easily running
with [docker-compose].

You can also theoretically run all the parts without docker or [docker-compose],
but you will need [arangodb] and either [redpanda] or [kafka]
for the micro-services to use.

## OADA micro-services

For information on
the various micro-services comprising this reference implementation,
see [the `oada` folder](oada/).

## Installing

### Running a release

Download one of our [releases] and start it using [docker-compose].

```shell
cd folder/containing/release/docker-compose
# Will pull the corresponding release images from dockerhub
DOMAIN=yourdomain.com docker-compose up -d
```

### Running from the git

If you want to contribute, or do other development type things,
you can run the server straight from this code base.

```shell
git clone https://github.com/OADA/server.git
cd server
# Running up the first time will automatically build the docker images
DOMAIN=yourdomain.com docker-compose up -d
```

Note that running from the git is **not** recommended for production use.

### Using `oadadeploy`

If you need to migrate an OADA v2 instance,
or are making a new installation but for some reason
are averse to managing you own configuration,
see [`oadadeploy`].

## Configuration

To modify the docker-compose configuration of you OADA instance,
you can simply create a `docker-compose.override.yml`
in the same directory as the `docker-compose.yml` file.
Any settings in this [override file] will be merged with ours
when running docker-compose.

### Environment variables

Additionally, there are various configuration environment variables available.
Some important ones are:

- DOMAIN: set to the domain name of your API server
  (e.g., `oada.mydomain.net`)
- EXTRA_DOMAINS: Additional domains to serve
  (e.g., `oada.mydomain.org,oada.myotherdomain.net`)
- DEBUG: set the namespace(s) enabled in [debug]
  (e.g., `*:info,*:error,*:warn`)

Rather than trying to always remembering to set your environment variables,
you probably want to use a [.env file] for things like `DOMAIN`.

[releases]: https://github.com/OADA/server/releases
[docker-compose]: https://docs.docker.com/compose/
[.env file]: https://docs.docker.com/compose/environment-variables/#substitute-environment-variables-in-compose-files
[arangodb]: https://www.arangodb.com
[redpanda]: https://vectorized.io/redpanda
[kafka]: https://kafka.apache.org
[override file]: https://docs.docker.com/compose/extends/#understanding-multiple-compose-files
[debug]: https://www.npmjs.com/package/debug#usage
[`oadadeploy`]: https://github.com/OADA/oadadeploy
