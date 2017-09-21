'use strict';

var Promise = require('bluebird');
const uuid = require('uuid');
const express = require('express');
const bodyParser = require('body-parser');

const info = require('debug')('http-handler:info');
const warn = require('debug')('http-handler:warn');
//const error = require('debug')('http-handler:error');
const trace = require('debug')('http-handler:trace');

const resources = require('../../libs/oada-lib-arangodb').resources;
const putBodies = require('../../libs/oada-lib-arangodb').putBodies;
const OADAError = require('oada-error').OADAError;

const config = require('./config');

var requester = require('./requester');

var router = express.Router();
var expressWs = require('express-ws')(router)

// Turn POSTs into PUTs at random id
router.post('/*?', function postResource(req, res, next) {
    // TODO: Is this a good way to generate new id?
    if (req.url === '' || req.url.endsWith('/')) {
        req.url += uuid();
    } else {
        req.url += '/' + uuid();
    }
    req.method = 'PUT';

    next();
});

router.use(function graphHandler(req, res, next) {
    return requester.send({
        'connection_id': req.id,
        'token': req.get('authorization'),
        'url': '/resources' + req.url,
        'user_id': req.user.doc.user_id
    }, config.get('kafka:topics:graphRequest'))
    .then(function handleGraphRes(resp) {
        if (resp['resource_id']) {
            // Rewire URL to resource found by graph
            let url = `${resp['resource_id']}${resp['path_leftover']}`;
            // Remove "/resources" from id
            req.url = url.replace(/^\/?resources\//, '/');
        }
        res.set('Content-Location', req.baseUrl + req.url);
        // TODO: Just use express parameters rather than graph thing?
        req.oadaGraph = resp;
    })
    .asCallback(next);
});

router.put('/*', function checkScope(req, res, next) {
    requester.send({
        'connection_id': req.id,
        'oadaGraph': req.oadaGraph,
        'user_id': req.user.doc['user_id'],
        'scope': req.user.doc.scope,
        'contentType': req.get('Content-Type'),
    }, config.get('kafka:topics:permissionsRequest'))
    .then(function handlePermissionsRequest(response) {
        if (!req.oadaGraph['resource_id']) { // PUTing non-existant resource
            return;
        } else if (!response.permissions.owner && !response.permissions.write) {
                warn(req.user.doc['user_id'] +
                    ' tried to GET resource without proper permissions');
            throw new OADAError('Not Authorized', 403,
                    'User does not have write permission for this resource');
        }
        if (!response.scopes.write) {
            throw new OADAError('Not Authorized', 403,
                    'Token does not have required scope');
        }
    }).asCallback(next);
});

router.get('/*', function checkScope(req, res, next) {
    requester.send({
        'connection_id': req.id,
        'oadaGraph': req.oadaGraph,
        'user_id': req.user.doc['user_id'],
        'scope': req.user.doc.scope,
    }, config.get('kafka:topics:permissionsRequest'))
    .then(function handlePermissionsRequest(response) {
        trace('permissions response:' + response);
        if (!response.permissions.owner && !response.permissions.read) {
            warn(req.user.doc['user_id'] +
                    ' tried to GET resource without proper permissions');
            throw new OADAError('Not Authorized', 403,
                    'User does not have read permission for this resource');
        }

        if (!response.scopes.read) {
            throw new OADAError('Not Authorized', 403,
                    'Token does not have required scope');
        }
    }).asCallback(next);
});

router.ws('/:resourceId/_meta/_changes', function(ws, req) {
    trace('Got it yo')
    // Now stream stuff back
    requester.emitter({
        'connection_id': req.id,
        'oadaGraph': req.oadaGraph,
        'user_id': req.user.doc['user_id'],
        'scope': req.user.doc.scope,
    }, config.get('kafka:topics:websocketsRequest')).then((emitter) => {
        emitter.on('response', (msg) => {
            trace('MESSAGE RECEIVED FROM WEBSOCKETS IN HTTP HANDLER', msg)
            ws.send(msg)
        })
        ws.on('close', emitter.close())
    });
});

router.get('/*', function getResource(req, res, next) {
    // TODO: Should it not get the whole meta document?
    // TODO: Make getResource accept an array of paths and return an array of
    //       results. I think we can do that in one arango query

    var doc = resources.getResource(
            req.oadaGraph['resource_id'],
            req.oadaGraph['path_leftover']
    ).tap(res => {
        trace('doc that was returned from getResource = ', res);
    });

    return Promise
        .join(doc, function returnDoc(doc) {
            // TODO: Allow null values in OADA?
            if (doc === undefined || doc === null) {
                throw new OADAError('Not Found', 404);
            }

            doc = unflattenMeta(doc);
            info('doc unflattened now');
            return res.json(doc);
        })
        .catch(next);
});

// TODO: This was a quick make it work. Do what you want with it.
function unflattenMeta(doc) {
    if (doc === null) {
        // Object.keys does not like null
        return null;
    }
    if (doc._meta) {
        doc._meta = {
            _id: doc._meta._id,
            _rev: doc._meta._rev,
        };
    }
    if (doc._changes) {
        doc._changes = {
            _id: doc._changes._id,
            _rev: doc._changes._rev,
        };
    }/*
    Object.keys(doc).forEach((key) => {
        if (doc[key]._id) {
            if (doc[key]['_oada_rev']) {
                doc[key] = {
                    '_id': doc[key]._id,
                    '_rev': doc[key]['_oada_rev']
                };
            } else {
                doc[key] = {_id: doc[key]._id};
            }
        } else {
            if (typeof doc[key] === 'object') {
                doc[key] = unflattenMeta(doc[key]);
            }
        }
    });
    */
    return doc;
}

// Don't let users modify their shares?
function noModifyShares(req, res, next) {
    let err = null;

    if (req.url.match(`^/${req.user.doc['shares_id']}`)) {
        err = new OADAError('Forbidden', 403,
            'User cannot modify their shares document');
    }

    next(err);
}
router.delete('/*', noModifyShares);
router.put('/*', noModifyShares);

// Parse JSON content types as text (but do not parse JSON yet)
router.put('/*', bodyParser.text({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
}));

router.put('/*', function putResource(req, res, next) {
    info(`Saving PUT body for request ${req.id}`);
    return putBodies.savePutBody(req.body)
        .tap(() => info(`PUT body saved for request ${req.id}`))
        .get('_id')
        .then(bodyid => {
            return requester.send({
                'connection_id': req.id,
                'url': req.url,
                'resource_id': req.oadaGraph['resource_id'],
                'path_leftover': req.oadaGraph['path_leftover'],
                'meta_id': req.oadaGraph['meta_id'],
                'user_id': req.user.doc['user_id'],
                'authorizationid': req.user.doc['authorizationid'],
                'client_id': req.user.doc['client_id'],
                'contentType': req.get('Content-Type'),
                'bodyid': bodyid,
                //body: req.body
            }, config.get('kafka:topics:writeRequest'));
        })
        .tap(function checkWrite(resp) {
            info(`Recieved write response for request ${req.id}`);
            switch (resp.code) {
                case 'success':
                    return;
                case 'permission':
                    return Promise.reject(new OADAError('Not Authorized', 403,
                            'User does not own this resource'));
                default:
                    let msg = 'write failed with code ' + resp.code;

                    return Promise.reject(new OADAError(msg));
            }
        })
        .then(function(resp) {
            return res
                .set('X-OADA-Rev', resp['_rev'])
                .redirect(204, req.baseUrl + req.url);
        })
        .catch(next);
});

// Don't let users DELETE their bookmarks?
router.delete('/*', function noDeleteBookmarks(req, res, next) {
    let err = null;

    if (req.url === '/' + req.user.doc['bookmarks_id']) {
        err = new OADAError('Forbidden', 403,
            'User cannot delete their bookmarks');
    }

    next(err);
});

router.delete('/*', function deleteLink(req, res, next) {
    // Check if followed a link and are at the root of the linked resource
    if (req.oadaGraph.from['path_leftover'] &&
            !req.oadaGraph['path_leftover']) {
        // Switch to DELETE on parent resource
        let id = req.oadaGraph.from['resource_id'];
        let path = req.oadaGraph.from['path_leftover'];
        req.url = id.replace(/^\/?resources\//, '') + path;

        req.oadaGraph = req.oadaGraph.from;
    }

    next();
});

router.delete('/*', function deleteResource(req, res, next) {
    info(`Sending DELETE request for request ${req.id}`);
    return requester.send({
        'connection_id': req.id,
        'url': req.url,
        'resource_id': req.oadaGraph['resource_id'],
        'path_leftover': req.oadaGraph['path_leftover'],
        'meta_id': req.oadaGraph['meta_id'],
        'user_id': req.user.doc['user_id'],
        'authorizationid': req.user.doc['authorizationid'],
        'client_id': req.user.doc['client_id'],
        //'bodyid': bodyid, // No body means delete?
        //body: req.body
    }, config.get('kafka:topics:writeRequest'))
    .tap(function checkDelete(resp) {
        info(`Recieved delete response for request ${req.id}`);
        switch (resp.code) {
            case 'success':
                return;
            case 'not_found':
                // fall-through
                // TODO: Is 403 a good response for DELETE on non-existent?
            case 'permission':
                return Promise.reject(new OADAError('Not Authorized', 403,
                        'User does not own this resource'));
            default:
                let err = new OADAError('delete failed with code ' + resp.code);
                return Promise.reject(err);
        }
    })
    .then(function(resp) {
        return res
            .set('X-OADA-Rev', resp['_rev'])
            .sendStatus(204);
    })
    .catch(next);
});



module.exports = router;
