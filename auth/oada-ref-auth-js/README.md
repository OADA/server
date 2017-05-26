[![Build Status](https://travis-ci.org/OADA/oada-ref-auth-js.svg?branch=master)](https://travis-ci.org/OADA/oada-ref-auth-js)
[![Coverage Status](https://coveralls.io/repos/OADA/oada-ref-auth-js/badge.svg)](https://coveralls.io/r/OADA/oada-ref-auth-js)
[![Dependency Status](https://david-dm.org/oada/oada-ref-auth-js.svg)](https://david-dm.org/oada/oada-ref-auth-js)
[![License](http://img.shields.io/:license-Apache%202.0-green.svg)](http://www.apache.org/licenses/LICENSE-2.0.html)

# Table of Contents

- [oada-ref-auth-js](#oada-ref-auth-js)
  - [Live Example](#live-example)
  - [OADA Authorization and Authentication Specs](#oada-authorization-and-authentication-specs)
  - [Installation Instructions](#installation-instructions)
    - [1. Get the code](#1-get-the-code)
    - [2. Install the Dependences](#2-install-the-dependences)
    - [3. Generate/Install SSL Certificates](#3-generateinstall-ssl-certificates)
      - [Reverse Proxy](#reverse-proxy)
      - [Trusted CA SSL Certificate in `node`](#trusted-ca-ssl-certificate-in-node)
      - [Generating a Self-Signed Certificate](#generating-a-self-signed-certificate)
        - [Generate a Certificate Authority Certificate (ca.crt)](#generate-a-certificate-authority-certificate-cacrt)
        - [Create a Server Private Key (server.key)](#create-a-server-private-key-serverkey)
        - [Create a Server Certificate (server.crt)](#create-a-server-certificate-servercrt)
        - [Save Private Key, CA Certificate, and Certificate](#save-private-key-ca-certificate-and-certificate)
    - [4. Generate/Install JWT Signing Certificates](#4-generateinstall-jwt-signing-certificates)
      - [With OpenSSL](#with-openssl)
      - [With OpenSSH](#with-openssh)
    - [5. Configure the Implementation](#5-configure-the-implementation)
    - [6. Start it up](#6-start-it-up)
  - [Adding New Database Abstraction Layer](#adding-new-database-abstraction-layer)

# oada-ref-auth-js

## Live Example

A live example of this project can be found on https://provider.oada-dev.com and
https://identity.oada-dev.com. A useful tool to interact with these is located
at https://client.oada-dev.com.

The minimal examples from [@OADA/oada-id-client-js][oada-id-client-js] project can also be easily be modified to interact with this server.

## OADA Authorization and Authentication Specs

See specifications of OADA's Authentication and Authorization can be found [here][auth-and-auth-sepcs].

## Installation Instructions

Installing the reference OADA authorization and authentication server is
relatively easily. The basic process is: 1. Download the code, 2. Run `npm
install`, 3. Generate SSL certificates, 4. Generate JWT signing certificates, 5.
Edit `config.js`, 6. Start it. Below are more detailed instructions:

### 1. Get the code

The easiest way to get the code is directly with `git` from github.com:

```sh
$ git clone https://github.com/OADA/oada-ref-auth-js
```

### 2. Install the Dependences
```sh
$ cd oada-ref-auth-js
$ npm install
```

### 3. Generate/Install SSL Certificates
OADA requires that all Authorization and Authentication flows happen over SSL.
There are three main options:

#### Reverse Proxy
Most reverse proxies can handle laying SSL on top of a standard HTTP session
transparently. As a result the `node` only needs to support standard HTTP.
[Nginx][nginx] is an example of such a reverse proxy option.

#### Trusted CA SSL Certificate in `node`
Node.js is capable of supporting SSL directly if provided a valid private key,
certificate, and CA certificate. If you choose this option then those three
files need to be sourced from a trusted CA of your choosing and stored in a
secure location that is accessible by the `node` process. Configuring
`oada-ref-auth-js` to locate the files are the subject of a later step.

#### Generating a Self-Signed Certificate
Self-signed certificates are not OADA compliant and will cause your user's
user-agent to popup a warning. However, they are very useful when developing and
testing. If you choose this method you need to generate a private key,
certificate, and CA certificate using the below, or your preferred, method and
store them in a secure location that is accessible by the `node` process.
Configuring `oada-ref-auth-js` to locate the files are the subject of a later
step.

The below directions are adapted from a [greengeckodesign.com
blog][greengeckodesign-blog] post.

##### Generate a Certificate Authority Certificate (ca.crt)
```sh
$ openssl genrsa -des3 -out ca.key 2048
$ openssl req -new -key ca.key -out ca.csr
$ openssl x509 -req -days 365 -in ca.csr -out ca.crt -signkey ca.key
```

##### Create a Server Private Key (server.key)
```sh
$ openssl genrsa -des3 -out server-passphrase.key 2048
```

##### Create a Server Certificate (server.crt)
```sh
$ openssl req -new -key server-passphrase.key -out server.csr
$ openssl rsa -in server-passphrase.key -out server.key
$ openssl x509 -req -days 365 -in server.csr -signkey server.key -out server.crt
```

##### Save Private Key, CA Certificate, and Certificate
```sh
$ cp server.key safe/and/secure/location
$ cp server.crt safe/and/secure/location
$ cp ca.crt safe/and/secure/location
```
### 4. Generate/Install JWT Signing Certificates
OpenID Connect and OADA's client secrets both use RSA signed JWTs and therefore
`oada-ref-auth-js` requires at least one RSA private. The key, in PEM form, can
be generated using the below instructions or any method of your choosing. Store
these files in a secure location is is accessible by the `node` process. The
keys files name will be used as the key's ID (`kid`). The `kid` is exposed
publicly. Configuring `oada-ref-auth-js` to locate the files are the subject of
a later step.

#### With OpenSSL
```sh
$ openssl genrsa -out <kid>.pem 2048
$ cp <kid>.pem safe/and/secure/location
```
#### With OpenSSH
```sh
$ ssh-keygen -t rsa -b 2048 -m PEM -f <kid>.pem
$ cp <kid>.pem safe/and/secure/location
```

### 5. Configure the Implementation
`oada-ref-auth-js` is configured by a single file `config.js`. It is recommended
that you copy this file to some safe and secure location outside of the the
repository so that upgrading `oada-ref-auth-js` is merely a mater doing a `git
pull`.

Currently the configuration options are:

**server**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| jsonSpaces | 2 | 0 to uglify output JSON, otherwise, it is the number of spaces a tab should be represented with in pretty print mode. Applies to all output JSON |
| sessionSecret | Xka\*32F@\*!15 | The secret used with the session hash table |
| passwordSalt | $2a$10$l64QftVz6.7KR5BXNc29IO | Salt for [bcrypt][bcrypt] when hashing passwords |
| port | 443 | The port in which the server should listen on |
| mode | http or https | If HTTP or HTTPS should be used (OADA compliance requires HTTPS) |
| domain | provider.example.com | The domain in which this server is running under |
| publicUri | https://provider.example.com:8443/oada | The full base URI in which the server is running under as seen by the outside world. This option is particularly useful for when this server is operating behind a reverse proxy or similar environment. If the desired publicUri is that of the one constructed by the above port, mode, and domain settings then this parameter can be omitted. |

**endpoints**

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| authorize | /auth | The desired path after `root` for the OAuth 2.0 authorization endpoint |
| token | /token | The desired path after `root` for the OAuth 2.0 token endpoint |
| decision | /decision | The desired path after `root` for the OAuth 2.0 "grant screen" |
| register | /register | The desired path after `root` for the OAuth 2.0
Dynamic Client Registartion |
| login | /login | The desired path after `root` for the OAuth 2.0 "login screen" |
| logout | /logout | The desired path after `root` to logout of the current session |
| certs | /certs | The desired path after `root` for the JWT RSA public keys |
| userinfo | /userinfo | The desired path after `root` for the OpenID Connect Userinfo endpoint |

**oauth2**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| enable | true | Enable the OAuth 2.0 portions of the reference implementation |

**oidc**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| enable | true | Enable the OpenID Connect portions of the reference implementation |

**code**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| length | 25 | The length of the random code in the OAuth 2.0 `code` flow |
| expiresIn | 10 | The length of time in seconds the the code in the OAuth 2.0 `code` flow is valid for |

**idToken**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| expiresIn | 3600 | The length of time in seconds the idToken for OpenID Connect is valid for |
| signKid | kjcScjc32dwJXXLJDs3r124sa1 | The kid for the private key in with JWTs should be signed with |

**certs**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| key | fs.readFileSync(path.join(__dirname, 'certs/ssl/server.key')) | The PEM string for the server's SSL private key. Only needed when `httpMode` = false |
| cert | fs.readFileSync(path.join(__dirname, 'certs/ssl/server.crt')) | The PEM string for the server's SSL certificate. Only needed when `httpMode` = false |
| ca | fs.readFileSync(path.join(__dirname, 'certs/ssl/ca.crt')) | The PEM string for the CA's SSL certificate. Only needed when `httpMode` = false |
| requestCrt | true | A boolean indicating whether a server should request a certificate from a connecting client. Only applies to server connections. |
| rejectUnauthorized | false | A boolean indicating whether a server should automatically reject clients with invalid certificates. Only applies to servers with requestCert enabled. |

**keys**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| signPems | path.join(__dirname, 'certs/sign/') | The path to the JWT signing PEMs |


**mongo**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| connectionString | localhost/oada-ref-auth | The mongodb connection string. Only needed for mongodb is in use |

**datastores**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| users | ./db/flat/users | The path to the database abstraction used to store users. Current options: ./db/flat/users (in-memory) or ./db/mongo/users (mongodb) |
| clients | ./db/flat/clients | The path to the database abstraction used to store clients. Current options: ./db/flat/clients (in-memory) or ./db/mongo/clients (mongodb) |
| tokens | ./db/flat/tokens | The path to the database abstraction used to store tokens. Current options: ./db/flat/tokens (in-memory) or ./db/mongo/tokens (mongodb) |
| codes | ./db/flat/codes | The path to the database abstraction used to store users. Current options: ./db/flat/codes (in-memory) or ./db/mongo/codes (mongodb) |

**hint**:

| Key | Example Value | Description |
| --- | ----------- | ------------ |
| username | frank | The "hint" for the username on the login screen. Used to for demonstration |
| password | pass | The "hint" for the password on the login screen. Used to for demonstration |

### 6. Start it up
`oada-ref-auth-js` has a single optional parameter which is the path to the
desired configuration file. If it is not given then it is assumed the
`config.js` in the root of the `oada-ref-auth-js` repository is the desired
configuration file.

```sh
$ node index.js path/to/config.js
```

or

```sh
$ node index.js
```

## Adding New Database Abstraction Layer

New database abstraction layers can be easily added to the project. The easiest way is to copy `./db/flat` or `./db/mongo` to `./db/<new-layers-name>` and then edit the `clients.js`, `users.js`, `codes.js` and `tokens.js` files to use the new database.

Here is a table of functions should be edited for each file:

| File | Functions Name |
| ---- | -------------- |
| `clients.js` | findById |
| `users.js` | findById, findByUsernamePassword |
| `codes.js` | findByCode, save |
| `tokens.js` | findByToken, save |

The **datastores** section of the configuration file needs to be updated to use
the new abstraction layer.

[nginx]: http://nginx.org/
[greengeckodesign-blog]: http://greengeckodesign.com/blog/2013/06/15/creating-an-ssl-certificate-for-node-dot-js/
[bcrypt]: http://bcrypt.sourceforge.net/
[oada-id-client-js]: https://github.com/OADA/oada-id-client-js
[auth-and-auth-sepcs]: https://github.com/OADA/oada-docs/blob/master/rest-specs/Authentication_and_Authorization.md
