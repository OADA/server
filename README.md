[![License](https://img.shields.io/github/license/OADA/oada-srvc-docker)](LICENSE)

# OADA Reference API Server

This project is a reference implementation of an OADA-conformant API server.
It can be used to host easily run your own OADA instance,
or for comparison when creating an OADA-conformant API implementation.

The repository and releases come with configurations for easily running
with [docker-compose].

You can also theoretically run all the parts without docker or [docker-compose],
but you will need [arangodb], [kafka], and [zookeeper] running
for the micro-services to use.

## OADA micro-services

For information on
the various micro-services comprising this reference implementation,
see [here](oada/).

## Installing

### Running a release

Download one of our [releases] and start it using [docker-compose].

```shellSession
$ cd folder/containing/release/docker-compose
$ # Will pull the corresponding release images from dockerhub
$ DOMAIN=yourdomain.com docker-compose up -d
```

### Running from the git

If you want to contribute, or do other development type things,
you can running straight from our code base.

```shellSession
$ git clone https://github.com/OADA/oada-srvc-docker.git
$ cd oada-srvc-docker
$ # Running up the first time will automatically build the docker images
$ DOMAIN=yourdomain.com docker-compose up -d
```

Note that running from the git is __not__ recommended for production use.

### Using `oadadeploy`

If you need to migrate an oada v2 instance,
or are making a new installation but for some reason
are averse to managing you own configuration,
see [`oadadeploy`].

## Configuration

To modify the docker-compose configuration of you OADA instance,
you can simply create a `docker-compose.override.yml`
in the same directory as the `docker-compose.yml` file.
Any settings in this [override file] will be merged with ours
when running docker-compose.

Additionally, there are various environment variables available:

- DOMAIN: set to the domain name of your API server
  (e.g., `oada.mydomain.net`)
- EXTRA_DOMAINS: Additional domains to serve
  (e.g., `oada.mydomain.org,oada.myotherdomain.net`)
- DEBUG: set the namespace(s) enabled in [debug]
  (e.g., `*:info,*:error,*:warn`)

[releases]: https://github.com/OADA/oada-srvc-docker/releases

[docker-compose]: https://docs.docker.com/compose/
[arangodb]: https://www.arangodb.com
[kafka]: https://kafka.apache.org
[zookeeper]: https://zookeeper.apache.org
[override file]: https://docs.docker.com/compose/extends/#understanding-multiple-compose-files
[debug]: https://www.npmjs.com/package/debug#usage
[`oadadeploy`]: https://github.com/OADA/oadadeploy
