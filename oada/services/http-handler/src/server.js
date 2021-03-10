'use strict';

const Bluebird = require('bluebird');
const express = require('express');
const expressPromise = require('express-promise');
const ksuid = require('ksuid');
const cors = require('cors');
const wellKnownJson = require('well-known-json');
const oadaError = require('oada-error');
const { OADAError } = oadaError;

const info = require('debug')('http-handler:server:info');
const warn = require('debug')('http-handler:server:warn');
const error = require('debug')('http-handler:server:error');
const trace = require('debug')('http-handler:server:trace');

var config = require('./config');

/////////////////////////////////////////////////////////////////
// Setup express:
const http = require('http');
var app = express();
var server = http.createServer(app);
const tokenLookup = require('./tokenLookup');
var resources = require('./resources');
var authorizations = require('./authorizations');
var users = require('./users');
require('./websockets')(server);

var requester = require('./requester');

app.get('*', (req, res, next) => {
  next();
});
app.get('/favicon.ico', (req, res) => res.end());

function start() {
  return Bluebird.fromCallback(function (done) {
    info('Starting server...');
    server.listen(config.get('server:port'), done);
  }).tap(() => {
    info('OADA Server started on port %d', config.get('server:port'));
  });
}
// Allow route handlers to return promises:
app.use(expressPromise());

// Log all requests before anything else gets them for debugging:
app.use(function (req, res, next) {
  trace('Received request: ' + req.method + ' ' + req.url);
  trace('req.headers = %O' + req.headers);
  trace('req.body = %O', req.body);
  next();
});
// Turn on CORS for all domains, allow the necessary headers
app.use(
  cors({
    exposedHeaders: ['x-oada-rev', 'location', 'content-location'],
  })
);
app.options('*', cors());

////////////////////////////////////////////////////////
// Configure the OADA well-known handler middleware
var wellKnownHandler = wellKnownJson({
  headers: {
    'content-type': 'application/vnd.oada.oada-configuration.1+json',
  },
});
//wellKnownHandler.addResource('oada-configuration', config.oada_configuration);
app.use(wellKnownHandler);

app.use(function requestId(req, res, next) {
  const { localAddress, remoteAddress } = req.connection;
  const requestId = req.get('X-Request-ID');
  // Allow requesting certain requestId with local requests
  if (localAddress === remoteAddress && requestId) {
    req.id = requestId;
  } else {
    req.id = ksuid.randomSync().string;
  }
  res.set('X-Request-ID', req.id);

  res.on('finish', () => trace(`finished request ${req.id}`));
  next();
});

app.use(function sanitizeUrl(req, res, next) {
  // OADA doesn't care about trailing slash
  req.url = req.url.replace(/\/$/, '');

  next();
});

app.use(function tokenHandler(req, res, next) {
  return tokenLookup({
    connection_id: req.id,
    domain: req.get('host'),
    token: req.get('authorization'),
  })
    .tap(function checkTok(tok) {
      if (!tok['token_exists']) {
        info('Token does not exist');
        throw new OADAError('Unauthorized', 401);
      }
      if (tok.doc.expired) {
        info('Token expired');
        throw new OADAError('Unauthorized', 401);
      }
    })
    .then(function handleTokRes(resp) {
      req.user = resp.doc;
      req.authorization = resp.doc; // for users handler
    })
    .asCallback(next);
});

// Rewrite the URL if it starts with /bookmarks
app.use(function handleBookmarks(req, res, next) {
  req.url = req.url.replace(/^\/bookmarks/, `/${req.user['bookmarks_id']}`);
  next();
});

// Rewrite the URL if it starts with /shares
app.use(function handleShares(req, res, next) {
  req.url = req.url.replace(/^\/shares/, `/${req.user['shares_id']}`);
  next();
});
/*
// Rewrite the URL if it starts with /services
app.use(function handleServices(req, res, next) {
    req.url = req.url.replace(/^\/services/,
        `/${req.user['services_id']}`);
    next();
});

// Rewrite the URL if it starts with /trash
app.use(function handleTrash(req, res, next) {
    req.url = req.url.replace(/^\/trash/,
        `/${req.user['trash_id']}`);
    next();
});
*/

app.use('/resources', resources);
app.use('/authorizations', authorizations);
app.use('/users', users);

//////////////////////////////////////////////////
// Default handler for top-level routes not found:
app.use(function (req) {
  throw new oadaError.OADAError(
    'Route not found: ' + req.url,
    oadaError.codes.NOT_FOUND
  );
});

///////////////////////////////////////////////////
// Use OADA middleware to catch errors and respond
app.use(oadaError.middleware(error));

if (require.main === module) {
  start();
}
module.exports = { start };
