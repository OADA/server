'use strict';

var Promise = require('bluebird');
const express = require('express');
const expressPromise = require('express-promise');
const uuid = require('uuid');
const cors = require('cors');
const wellKnownJson = require('well-known-json');
const oadaError = require('oada-error');
const OADAError = oadaError.OADAError;
const info = require('debug')('http-handler:info');
//const warn = require('debug')('http-handler:warn');
const error = require('debug')('http-handler:error');
//const trace = require('debug')('http-handler:trace');

var config = require('./config');

var resources = require('./resources');
var authorizations = require('./authorizations');
var users = require('./users');

var requester = require('./requester');

/////////////////////////////////////////////////////////////////
// Setup express:
var app = express();
function start() {
    return Promise.fromCallback(function(done) {
        info('----------------------------------------------------------');
        info('Starting server...');

        app.set('port', config.get('server:port'));
        app.listen(app.get('port'), done);
    })
    .tap(() => {
        info('OADA Test Server started on port ' +
                app.get('port'));
    });
}
// Allow route handlers to return promises:
app.use(expressPromise());

// Log all requests before anything else gets them for debugging:
app.use(function(req, res, next) {
    info('Received request: ' + req.method + ' ' + req.url);
    info('req.headers = ', req.headers);
    info('req.body = ', req.body);
    next();
});

// Turn on CORS for all domains, allow the necessary headers
app.use(cors({
    exposedHeaders: ['x-oada-rev', 'location'],
}));
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
    req.id = uuid();
    res.set('X-Request-Id', req.id);

    res.on('finish', () => info(`finished request ${req.id}`));
    next();
});

app.use(function sanitizeUrl(req, res, next) {
    // OADA doesn't care about trailing slash
    req.url = req.url.replace(/\/$/, '');

    next();
});

app.use(function tokenHandler(req, res, next) {
    return requester.send({
        'connection_id': req.id,
        'token': req.get('authorization'),
    }, config.get('kafka:topics:tokenRequest'))
    .tap(function checkTok(tok) {
        if (!tok['token_exists']) {
            throw new OADAError('Unauthorized', 401);
        }
    })
    .then(function handleTokRes(resp) {
        req.user = resp;
    })
    .asCallback(next);
});

// Rewrite the URL if it starts with /bookmarks
app.use(function handleBookmarks(req, res, next) {
    req.url = req.url.replace(/^\/bookmarks/,
        `/${req.user.doc['bookmarks_id']}`);
    next();
});

// Rewrite the URL if it starts with /shares
app.use(function handleShares(req, res, next) {
    req.url = req.url.replace(/^\/shares/,
        `/${req.user.doc['shares_id']}`);
    next();
});

app.use('/resources', resources);
app.use('/authorizations', authorizations);
app.use('/users', users);

//////////////////////////////////////////////////
// Default handler for top-level routes not found:
app.use(function(req) {
    throw new oadaError
        .OADAError('Route not found: ' + req.url, oadaError.codes.NOT_FOUND);
});

///////////////////////////////////////////////////
// Use OADA middleware to catch errors and respond
app.use(oadaError.middleware(error));

if (require.main === module) {
    start();
}
module.exports = {start};

