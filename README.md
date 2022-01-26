# OADA Reference API Server

[![CodeFactor](https://www.codefactor.io/repository/github/OADA/server/badge)](https://www.codefactor.io/repository/github/OADA/server)
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
# Will pull the corresponding release images from DockerHub
DOMAIN=yourdomain.com docker-compose up -d
```

### Running as localhost

localhost doesn't work out of the box because you need to create a self-signed SSL certificate and map it into your OADA installation.

To generate a certificate, get [mkcert](https://github.com/FiloSottile/mkcert) (Works on pretty much every platform).
Then, install `mkcert` to your machine's local certificate authority (so when you make requests to your OADA, it will trust the self-signed certificate)

```shell
# Only do this if you did not previously have mkcert installed.
mkcert -install
```

Now generate a certificate for localhost (in a folder named localhost)

```shell
mkdir localhost
mkcert -cert-file ./localhost/fullchain.pem -key-file ./localhost/privkey.pem localhost
# The certificate is at "./localhost/fullchain.pem" and the key at "./localhost/privkey.pem"
```

Finally, tell OADA to use it by mapping it into the docker-compose service definition for the proxy.
NOTE: if you already have a `docker-compose.override.yml`, do not run this command as it will overwrite it.

```shell
# Configure docker to map in the new cert as an override:
printf "services:\n  proxy:\n    volumes:\n      - ./localhost:/config/keys/letsencrypt:ro" > docker-compose.override.yml
# Re-up the proxy container with the new cert:
DOMAIN=localhost docker-compose up -d proxy
```

Your server should now be working on localhost. Time to add a user and a token with which to make requests.

### Add a user

You will need to add a user and a token to start making requests against your new OADA server. To add a user:

```shell
docker-compose run users add -u username -p password -a
```

replacing `username` and `password` with the username and password that you want. The `-a` means that the created user will be an admin user with the ability to add other users via the API.0

### Add a token for a user

You need a token to make a request against an OADA server. While you can get a token via OAuth2, to add a token
for a user from the command line:

```shell
docker-compose run auth token create -u username -s all:all
```

The "-s" is the "scope" for the token. `all:all` means read/write for all content types. The token will have permission to any resources that the user has permission to.

That command will print the last line `Successfully wrote token <token>`. Copy the `<token>` for the authorization header on your requests.

### Running from the git

If you want to contribute, or do other development type things,
you can run the server straight from this codebase.

```shell
git clone https://github.com/OADA/server.git
cd server
# Running up the first time will automatically build the docker images
DOMAIN=yourdomain.com docker-compose up -d
```

Note that running from the git is **not** recommended for production use.


## Configuration

To modify the docker-compose configuration of your OADA instance,
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

Rather than trying to always remember to set your environment variables,
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
