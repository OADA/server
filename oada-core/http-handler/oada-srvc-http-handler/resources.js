'use strict';

global.Promise = require('bluebird');
const uuid = require('uuid');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const pointer = require('json-pointer');
const _ = require('lodash');

const info = require('debug')('http-handler:info');
const warn = require('debug')('http-handler:warn');
const error = require('debug')('http-handler:error');
const trace = require('debug')('http-handler:trace');

const resources = require('../../libs/oada-lib-arangodb').resources;
const changes = require('../../libs/oada-lib-arangodb').changes;
const putBodies = require('../../libs/oada-lib-arangodb').putBodies;
const OADAError = require('oada-error').OADAError;

const { pipeline } = require('stream');
const pipelineAsync = require('bluebird').promisify(pipeline);
const cacache = require('cacache');

const CACHE_PATH = "tmp/oada-cache";

const config = require('./config');

var requester = require('./requester');

var router = express.Router();
var expressWs = require('express-ws')(router);

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
    Promise.resolve(
        resources.lookupFromUrl("/resources" + req.url, req.user.user_id),
    )
        .then(function handleGraphRes(resp) {
            info("GRAPH LOOKUP RESULT", resp);
            if (resp["resource_id"]) {
                // Rewire URL to resource found by graph
                let url = `${resp["resource_id"]}${resp["path_leftover"]}`;
                // log
                console.log(`Graph lookup: ${req.url} => ${url}`);
                // Remove "/resources" from id
                req.url = url.replace(/^\/?resources\//, "/");
            }
            res.set("Content-Location", req.baseUrl + req.url);
            // TODO: Just use express parameters rather than graph thing?
            req.oadaGraph = resp;
            req.resourceExists = _.clone(resp.resourceExists);
        })
        .asCallback(next);
});

router.delete('/*', function checkScope(req, res, next) {
    requester.send({
        'connection_id': req.id,
        'domain': req.get('host'),
        'oadaGraph': req.oadaGraph,
        'user_id': req.user['user_id'],
        'scope': req.user.scope,
        'contentType': req.get('content-type'),
	'requestType': 'put'
    }, config.get('kafka:topics:permissionsRequest'))
    .then(function handlePermissionsRequest(response) {
        if (!req.oadaGraph['resource_id']) { // PUTing non-existant resource
            return;
        } else if (!response.permissions.owner && !response.permissions.write) {
                warn(req.user['user_id'] +
                    ' tried to GET resource without proper permissions');
            throw new OADAError('Forbidden', 403,
                    'User does not have write permission for this resource');
        }
        if (!response.scopes.write) {
            throw new OADAError('Forbidden', 403,
                    'Token does not have required scope');
        }
    }).asCallback(next);
});

router.put('/*', function checkScope(req, res, next) {
    requester.send({
        'connection_id': req.id,
        'domain': req.get('host'),
        'oadaGraph': req.oadaGraph,
        'user_id': req.user['user_id'],
        'scope': req.user.scope,
        'contentType': req.get('content-type'),
    	'requestType': 'put'
    }, config.get('kafka:topics:permissionsRequest'))
    .then(function handlePermissionsRequest(response) {
        if (!req.oadaGraph['resource_id']) { // PUTing non-existant resource
            return;
        } else if (!response.permissions.owner && !response.permissions.write) {
                warn(req.user['user_id'] +
                    ' tried to GET resource without proper permissions');
            throw new OADAError('Forbidden', 403,
                    'User does not have write permission for this resource');
        }
        if (!response.scopes.write) {
            throw new OADAError('Forbidden', 403,
                    'Token does not have required scope');
        }
    }).asCallback(next);
});

router.get('/*', function checkScope(req, res, next) {
    requester.send({
        'connection_id': req.id,
        'domain': req.get('host'),
        'oadaGraph': req.oadaGraph,
        'user_id': req.user['user_id'],
        'scope': req.user.scope,
	'requestType': 'get'
    }, config.get('kafka:topics:permissionsRequest'))
    .then(function handlePermissionsRequest(response) {
        trace('permissions response: %o', response);
        if (!response.permissions.owner && !response.permissions.read) {
            warn(req.user['user_id'] +
                    ' tried to GET resource without proper permissions');
            throw new OADAError('Forbidden', 403,
                    'User does not have read permission for this resource');
        }

        if (!response.scopes.read) {
            throw new OADAError('Forbidden', 403,
                    'Token does not have required scope');
        }
    }).asCallback(next);
});

// Handle request for /_meta/_changes
router.get('/*', async function getChanges(req, res, next) {
    try {
        if (req.oadaGraph.path_leftover === '/_meta/_changes') {
            let ch = await changes.getChanges(req.oadaGraph.resource_id);
            return res.json(ch.map((item) => {
                return {
                    [item]: {
                        _id: req.oadaGraph.resource_id+'/_meta/_changes/'+item,
                        _rev: item
                    }
                }
            }).reduce((a,b) => {
                return {...a, ...b}
            }))
        } else if (/^\/_meta\/_changes\/.*?/.test(req.oadaGraph.path_leftover)) {
            let rev = req.oadaGraph.path_leftover.split('/')[3];
            let ch = await changes.getChange(req.oadaGraph.resource_id, rev);
            trace('CHANGE', ch)
            return res.json(ch)
        } else {
            return next()
        }
    } catch (e) {
        next(e)
    }
});

router.get('/*', async function getResource(req, res, next) {
    // TODO: Should it not get the whole meta document?
    // TODO: Make getResource accept an array of paths and return an array of
    //       results. I think we can do that in one arango query

    var doc = resources.getResource(
            req.oadaGraph['resource_id'],
            req.oadaGraph['path_leftover']
    );

    // TODO check json content-type or if _id end in '/_meta'
    if ((req.oadaGraph['type'] && req.oadaGraph['type'].match(/[\/|+]json$/))
        || req.oadaGraph['path_leftover'].match(/\/_meta$/)) {
        return Promise.join(doc, function returnDoc(doc) {
            info("DOC IS", doc);
            // TODO: Allow null values in OADA?
            if (doc === undefined || doc === null) {
                console.log("Resource not found");
                throw new OADAError("Not Found", 404);
            } else {
                console.log(
                    `Resource: ${req.oadaGraph.resource_id}, Rev: ${req.oadaGraph.rev}`,
                );
            }

            doc = unflattenMeta(doc);
            info("doc unflattened now");
            return res.set("X-OADA-Rev", req.oadaGraph.rev).json(doc);
        }).catch(next);
    } else {
        // get binary
        if (req.oadaGraph['path_leftover']) {
            info(req.oadaGraph['path_leftover']);
            throw new OADAError("Not final document");
        }

        await pipelineAsync(
            cacache.get.stream(CACHE_PATH, req.oadaGraph["resource_id"]),
            res,
        );
    }
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
    /*
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

    if (req.url.match(`^/${req.user['shares_id']}`)) {
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

/*
router.put('/*', function checkBodyParsed(req, res, next) {
    let err = null;

    // TODO: Better way to decide if body was parsed?
    if (typeof req.body !== 'string') {
        // Body hasn't been parsed, assume it was bad
        err = new OADAError('Unsupported Media Type', 415);
    }

    return next(err);
});
*/


router.put('/*', async function ensureTypeTreeExists(req, res, next) {
    if (req.headers['x-oada-bookmarks-type']) {
        let rev = req.oadaGraph.rev
        let tree = trees[req.headers['x-oada-bookmarks-type']];// Get the tree

        //First, get the appropriate subTree rooted at the resource returned by
        //graph lookup
        let path =
            req.originalUrl.split(req.oadaGraph.path_leftover)[0].replace(/^\/bookmarks/,'');
        let subTree = await getFromStarredTree(path, tree)
        // Find all resources in the subTree that haven't been created
        let pieces = pointer.parse(req.oadaGraph.path_leftover);
        let piecesPath = '';
        let id = req.oadaGraph.resource_id.replace(/^\//, '');
        let parentId = req.oadaGraph.resource_id.replace(/^\//, '');
        let parentPath = '';
        let parentRev = rev;
        return Promise.each(pieces, async function(piece, i) {
            let nextPiece = pointer.has(subTree, '/'+piece) ? '/'+piece : (pointer.has(subTree, '/*') ? '/*' : undefined);
            path += '/'+piece;
            piecesPath += nextPiece
            parentPath += '/'+piece
            if (nextPiece) {
                subTree = pointer.get(subTree, nextPiece)
                if (pointer.has(subTree, '/_type')) {
                  let contentType = pointer.get(subTree, '/_type');
                    id = 'resources/'+uuid.v4();
                    let body = await replaceLinks(_.cloneDeep(subTree))
                    // Write new resource. This may potentially become an
                    // orphan if concurrent requests make links below
                    return requester.send({
                        resource_id: '',
                        path_leftover: '/'+id,
                        user_id: req.user.user_id,
                        contentType,
                        body
                    }, config.get('kafka:topics:writeRequest')).tap((resp) => {

                        switch (resp.code) {
                            case 'success':
                                return;
                            default:
                                return Promise.reject(new Error(resp.code));
                        }
                    }).then(() => {
                    // Write link from parent. These writes reference the
                    // path from the known resource returned by graph lookup
                        let linkBody = {_id: id};
                        if (typeof body._rev === 'number') linkBody._rev = body._rev;
                        return requester.send({
                            rev: parentRev,
                            resource_id: parentId,
                            path_leftover: parentPath,
                            user_id: req.user.user_id,
                            contentType,
                            body: linkBody,
                        }, config.get('kafka:topics:writeRequest')).tap((result) => {
                            switch (result.code) {
                                case 'success':
                                    return;
                                default:
                                    return Promise.reject(new Error(result.code));
                            }
                        })
                    }).then((result) => {
                    // Write link from parent. These writes reference the
                    }).then(() => {
                        parentId = id;
                        parentPath = '';
                        parentRev = '';
                        return
                    })
                }
            }
            return
        }).then(() => {
            req.oadaGraph.resource_id = parentId;
            req.oadaGraph.path_leftover = parentPath;
            next()
        }).catch({message: 'rev mismatch'}, (err) => {
            trace('rev mismatch, rerunning', req.get('Authorization'))
            return axios({
                method: 'PUT',
                url: 'http://http-handler'+req.originalUrl,
                data: req.body,
                headers: {
                    Authorization: 'Bearer def',
                    'x-oada-bookmarks-type': req.get('x-oada-bookmarks-type'),
                    'Content-Type': req.get('content-type'),
                }
            })
        }).catch((error) => {
            trace('ERROR', error)
            next(error)
        })
    } else {
        next()
    }
})

router.put('/*', async function putResource(req, res, next) {
    info(`Saving PUT body for request ${req.id}`);
    if (req.header('content-type') && !req.header('content-type').match(/[\/|+]json$/)) {
        // put binary
        info(`Saving binary file format ${req.header('content-type')}`);
        await pipelineAsync(
            req,
            cacache.put.stream(CACHE_PATH, req.oadaGraph.resource_id),
        );

        req.body = '{}';
    }

    return putBodies.savePutBody(req.body)
        .tap(() => info(`PUT body saved for request ${req.id}`))
        .get('_id')

        .then(bodyid => {
            info("rrrRESOURCE EXISTS", req.oadaGraph);
            info("rrrRESOURCE EXISTS", req.resourceExists);
            return requester.send(
                {
                    connection_id: req.id,
                    resourceExists: req.resourceExists,
                    domain: req.get("host"),
                    url: req.url,
                    resource_id: req.oadaGraph["resource_id"],
                    path_leftover: req.oadaGraph["path_leftover"],
                    meta_id: req.oadaGraph["meta_id"],
                    user_id: req.user["user_id"],
                    authorizationid: req.user["authorizationid"],
                    client_id: req.user["client_id"],
                    contentType: req.get("content-type"),
                    bodyid: bodyid,
                    "if-match": req.get("if-match"),
                },
                config.get("kafka:topics:writeRequest"),
            );
        })
        .tap(function checkWrite(resp) {
            info(`Recieved write response for request ${req.id}`);
            switch (resp.code) {
                case 'success':
                    return;
                case 'permission':
                    return Promise.reject(new OADAError('Forbidden', 403,
                            'User does not own this resource'));
        case 'if-match failed':
            return Promise.reject(new OADAError('Precondition Failed', 412,
                'If-Match header does not match current resource _rev'));
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

    // } else {
    //     // put binary
    //     await pipelineAsync(
    //         req,
    //         cacache.put.stream(CACHE_PATH, req.oadaGraph.resource_id),
    //     );

    //     // TODO: what does savePutBody expect in the object?
    //     // TODO: potentially write resource_id to
    //     putBodies.savePutBody({});
    // }
});

// Don't let users DELETE their bookmarks?
router.delete('/*', function noDeleteBookmarks(req, res, next) {
    let err = null;

    if (req.url === '/' + req.user['bookmarks_id']) {
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
        req.url = '/' + id.replace(/^\/?resources\//, '') + path;
        req.oadaGraph = req.oadaGraph.from;

    }

    next();
});

router.delete('/*', function deleteResource(req, res, next) {
    info(`Sending DELETE request for request ${req.id}`);
    return requester.send({
        'resourceExists': req.resourceExists,
        'connection_id': req.id,
        'domain': req.get('host'),
        'url': req.url,
        'resource_id': req.oadaGraph['resource_id'],
        'path_leftover': req.oadaGraph['path_leftover'],
        'meta_id': req.oadaGraph['meta_id'],
        'user_id': req.user['user_id'],
        'authorizationid': req.user['authorizationid'],
        'client_id': req.user['client_id'],
    	'if-match': req.get('if-match')
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
                return Promise.reject(new OADAError('Forbidden', 403,
                        'User does not own this resource'));
    	    case 'if-match failed':
		return Promise.reject(new OADAError('Precondition Failed', 412,
			'If-Match header does not match current resource _rev'));
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

let trees = {
  'fields': {
    'fields': {
      '_type': "application/vnd.oada.fields.1+json",
      '_rev': 0,
      'fields-index': {
        '*': {
          '_type': "application/vnd.oada.field.1+json",
          '_rev': 0,
          'fields-index': {
            '*': {
              '_type': "application/vnd.oada.field.1+json",
              '_rev': 0,
            }
          }
        }
      }
    },
  },
  'as-harvested': {
      'harvest': {
          '_type': "application/vnd.oada.harvest.1+json",
          '_rev': 0,
          'as-harvested': {
              '_type': "application/vnd.oada.as-harvested.1+json",
              '_rev': 0,
              'yield-moisture-dataset': {
                  '_type': "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
                  '_rev': 0,
                  'crop-index': {
                      '*': {
                          '_type': "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
                          '_rev': 0,
                          'geohash-length-index': {
                              '*': {
                                  '_type': "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
                                  '_rev': 0,
                                  'geohash-index': {
                                      '*': {
                                          '_type': "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
                                      }
                                  }
                              }
                          }
                      }
                  }
              }
          },
      },
  },
  'tiled-maps': {
      'harvest': {
          '_type': "application/vnd.oada.harvest.1+json",
          '_rev': 0,
          'tiled-maps': {
              '_type': "application/vnd.oada.tiled-maps.1+json",
              '_rev': 0,
              'dry-yield-map': {
                  '_type': "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
                  '_rev': 0,
                  'crop-index': {
                      '*': {
                          "_type": "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
                          '_rev': 0,
                          'geohash-length-index': {
                              '*': {
                                  "_type": "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
                                  '_rev': 0,
                                  'geohash-index': {
                                      '*': {
                                          "_type": "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
                                      }
                                  }
                              }
                          }
                      }
                  }
              }
          }
      }
  },
  'services': {
    'services': {
      '_type': 'application/vnd.oada.services.1+json',
      '_rev': 0,
      'datasilo': {
        '_type': 'application/vnd.oada.services.1+json',
        '_rev': 0,
      }
    }
  }
}

function replaceLinks(obj) {
  let ret = (Array.isArray(obj)) ? [] : {};
  if (!obj) return obj;  // no defined objriptors for this level
  return Promise.map(Object.keys(obj || {}), (key)  => {
    if (key === '*') { // Don't put *s into oada. Ignore them
      return;
    }
    let val = obj[key];
    if (typeof val !== 'object' || !val) {
      ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
      return;
    }
    if (val._type) { // If it has a '_type' key, don't worry about it.
      //It'll get created in future iterations of ensureTreeExists
      return;
    }
    if (val._id) { // If it's an object, and has an '_id', make it a link from descriptor
      ret[key] = { _id: obj[key]._id};
      if (typeof val._rev === 'number') ret[key]._rev = 0
      return;
    }
    // otherwise, recurse into the object looking for more links
    return replaceLinks(val).then((result) => {
      ret[key] = result;
      return;
    })
  }).then(() => {
    return ret;
  })
}

async function getFromStarredTree(path, tree) {
    if (path === '/' || path === '') return tree
    let pieces = pointer.parse(path);
    let subTree = tree;
    let starPath = '';
    return Promise.each(pieces, (piece, i) => {
        let nextPiece = pointer.has(tree, starPath+'/*') ? '/*' : '/'+piece;
        starPath += nextPiece;
        subTree = pointer.get(tree, starPath)
        return
    }).then(() => {
        return subTree
    })
}

module.exports = router;
