'use strict';

const Bluebird = require('bluebird');
const ksuid = require('ksuid');
const axios = require('axios');
const express = require('express');
const bodyParser = require('body-parser');
const pointer = require('json-pointer');
const typeis = require('type-is');
const { pipeline } = require('stream');
const pipelineAsync = Bluebird.promisify(pipeline);
const cacache = require('cacache');

const { resources } = require('@oada/lib-arangodb');
const { changes } = require('@oada/lib-arangodb');
const { putBodies } = require('@oada/lib-arangodb');
const { OADAError } = require('oada-error');

const config = require('./config');
const CACHE_PATH = config.get('storage:binary:cacache');

const requester = require('./requester');

const router = express.Router();

// Turn POSTs into PUTs at random id
router.post('/*?', function postResource(req, res, next) {
  if (!req.url === '' || !req.url.endsWith('/')) {
    req.url += '/';
  }
  req.url += ksuid.randomSync().string;
  req.method = 'PUT';

  next();
});

router.use(function graphHandler(req, res, next) {
  Bluebird.resolve(
    resources.lookupFromUrl('/resources' + req.url, req.user.user_id)
  )
    .then(function handleGraphRes(resp) {
      req.log.trace('GRAPH LOOKUP RESULT %O', resp);
      if (resp['resource_id']) {
        // Rewire URL to resource found by graph
        const url = `${resp['resource_id']}${resp['path_leftover']}`;
        // log
        req.log.info(`Graph lookup: ${req.url} => ${url}`);
        // Remove "/resources" from id
        req.url = url.replace(/^\/?resources\//, '/');
      }
      res.set('Content-Location', req.baseUrl + req.url);
      // TODO: Just use express parameters rather than graph thing?
      req.oadaGraph = resp;
      req.resourceExists = resp.resourceExists;
    })
    .asCallback(next);
});

router.delete('/*', function checkScope(req, res, next) {
  requester
    .send(
      {
        connection_id: req.id,
        domain: req.get('host'),
        oadaGraph: req.oadaGraph,
        user_id: req.user['user_id'],
        scope: req.user.scope,
        contentType: req.get('content-type'),
        requestType: 'delete',
      },
      config.get('kafka:topics:permissionsRequest')
    )
    .then(function handlePermissionsRequest(response) {
      if (!req.oadaGraph['resource_id']) {
        // PUTing non-existant resource
        return;
      } else if (!response.permissions.owner && !response.permissions.write) {
        req.log.warn(
          req.user['user_id'] +
            ' tried to GET resource without proper permissions'
        );
        throw new OADAError(
          'Forbidden',
          403,
          'User does not have write permission for this resource'
        );
      }
      if (!response.scopes.write) {
        throw new OADAError(
          'Forbidden',
          403,
          'Token does not have required scope'
        );
      }
    })
    .asCallback(next);
});

router.put('/*', function checkScope(req, res, next) {
  requester
    .send(
      {
        connection_id: req.id,
        domain: req.get('host'),
        oadaGraph: req.oadaGraph,
        user_id: req.user['user_id'],
        scope: req.user.scope,
        contentType: req.get('content-type'),
        requestType: 'put',
      },
      config.get('kafka:topics:permissionsRequest')
    )
    .then(function handlePermissionsRequest(response) {
      if (!req.oadaGraph['resource_id']) {
        // PUTing non-existant resource
        return;
      } else if (!response.permissions.owner && !response.permissions.write) {
        req.log.warn(
          req.user['user_id'] +
            ' tried to GET resource without proper permissions'
        );
        throw new OADAError(
          'Forbidden',
          403,
          'User does not have write permission for this resource'
        );
      }
      if (!response.scopes.write) {
        throw new OADAError(
          'Forbidden',
          403,
          'Token does not have required scope'
        );
      }
    })
    .asCallback(next);
});

router.get('/*', function checkScope(req, res, next) {
  requester
    .send(
      {
        connection_id: req.id,
        domain: req.get('host'),
        oadaGraph: req.oadaGraph,
        user_id: req.user['user_id'],
        scope: req.user.scope,
        requestType: 'get',
      },
      config.get('kafka:topics:permissionsRequest')
    )
    .then(function handlePermissionsRequest(response) {
      req.log.trace('permissions response: %o', response);
      if (!response.permissions.owner && !response.permissions.read) {
        req.log.warn(
          req.user['user_id'] +
            ' tried to GET resource without proper permissions'
        );
        throw new OADAError(
          'Forbidden',
          403,
          'User does not have read permission for this resource'
        );
      }

      if (!response.scopes.read) {
        throw new OADAError(
          'Forbidden',
          403,
          'Token does not have required scope'
        );
      }
    })
    .asCallback(next);
});

// Handle request for /_meta/_changes
router.get('/*', async function getChanges(req, res, next) {
  try {
    if (req.oadaGraph.path_leftover === '/_meta/_changes') {
      let ch = await changes.getChanges(req.oadaGraph.resource_id);
      return res.json(
        ch
          .map((item) => {
            return {
              [item]: {
                _id: req.oadaGraph.resource_id + '/_meta/_changes/' + item,
                _rev: item,
              },
            };
          })
          .reduce((a, b) => {
            return { ...a, ...b };
          })
      );
    } else if (/^\/_meta\/_changes\/.*?/.test(req.oadaGraph.path_leftover)) {
      let rev = req.oadaGraph.path_leftover.split('/')[3];
      let ch = await changes.getChangeArray(req.oadaGraph.resource_id, rev);
      req.log.trace('CHANGE %O', ch);
      return res.json(ch);
    } else {
      return next();
    }
  } catch (e) {
    next(e);
  }
});

router.get('/*', async function getResource(req, res, next) {
  // TODO: Should it not get the whole meta document?
  // TODO: Make getResource accept an array of paths and return an array of
  //       results. I think we can do that in one arango query

  res.set('Content-Type', req.oadaGraph.type);
  res.set('X-OADA-Rev', req.oadaGraph.rev);

  if (
    typeis.is(req.oadaGraph['type'], ['json', '+json']) ||
    req.oadaGraph['path_leftover'].match(/\/_meta$/)
  ) {
    var doc = resources.getResource(
      req.oadaGraph['resource_id'],
      req.oadaGraph['path_leftover']
    );

    return Bluebird.join(doc, function returnDoc(doc) {
      req.log.trace('DOC IS %O', doc);
      // TODO: Allow null values in OADA?
      if (doc === undefined || doc === null) {
        req.log.error('Resource not found');
        throw new OADAError('Not Found', 404);
      } else {
        req.log.info(
          `Resource: ${req.oadaGraph.resource_id}, Rev: ${req.oadaGraph.rev}`
        );
      }
      doc = unflattenMeta(doc);
      return res.json(doc);
    }).catch(next);
  } else {
    // get binary
    if (req.oadaGraph['path_leftover']) {
      req.log.trace(req.oadaGraph['path_leftover']);
      throw new OADAError('Path Leftover on Binary GET');
    }

    // Look up file size before streaming
    const { integrity, size } = await cacache.get.info(
      CACHE_PATH,
      req.oadaGraph['resource_id']
    );
    res.set('Content-Length', size);
    await pipelineAsync(
      cacache.get.stream.byDigest(CACHE_PATH, integrity),
      res
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
    err = new OADAError(
      'Forbidden',
      403,
      'User cannot modify their shares document'
    );
  }

  next(err);
}
router.delete('/*', noModifyShares);
router.put('/*', noModifyShares);

// Parse JSON content types as text (but do not parse JSON yet)
router.put(
  '/*',
  bodyParser.text({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
  })
);

router.put('/*', async function putResource(req, res, next) {
  req.log.trace(`Saving PUT body for request ${req.id}`);

  if (
    req.header('content-type') &&
    !req.header('content-type').match(/[\/|+]json$/)
  ) {
    await pipelineAsync(
      req,
      cacache.put.stream(CACHE_PATH, req.oadaGraph.resource_id)
    );
    req.body = '{}';
  }

  return putBodies
    .savePutBody(req.body)
    .tap(() => req.log.trace(`PUT body saved for request ${req.id}`))
    .get('_id')

    .then((bodyid) => {
      req.log.trace('RESOURCE EXISTS %O', req.oadaGraph);
      req.log.trace('RESOURCE EXISTS %O', req.resourceExists);
      let ignoreLinks =
        (req.get('x-oada-ignore-links') || '').toLowerCase() == 'true';
      return requester.send(
        {
          'connection_id': req.id,
          'resourceExists': req.resourceExists,
          'domain': req.get('host'),
          'url': req.url,
          'resource_id': req.oadaGraph['resource_id'],
          'path_leftover': req.oadaGraph['path_leftover'],
          'meta_id': req.oadaGraph['meta_id'],
          'user_id': req.user['user_id'],
          'authorizationid': req.user['authorizationid'],
          'client_id': req.user['client_id'],
          'contentType': req.get('content-type'),
          'bodyid': bodyid,
          'if-match': req.get('if-match'),
          ignoreLinks,
        },
        config.get('kafka:topics:writeRequest')
      );
    })
    .tap(function checkWrite(resp) {
      req.log.trace(`Recieved write response for request ${req.id}`);
      switch (resp.code) {
        case 'success':
          return;
        case 'permission':
          return Promise.reject(
            new OADAError('Forbidden', 403, 'User does not own this resource')
          );
        case 'if-match failed':
          return Promise.reject(
            new OADAError(
              'Precondition Failed',
              412,
              'If-Match header does not match current resource _rev'
            )
          );
        default:
          let msg = 'write failed with code ' + resp.code;
          return Promise.reject(new OADAError(msg));
      }
    })
    .then(function (resp) {
      return (
        res
          .set('X-OADA-Rev', resp['_rev'])
          // TODO: What is the right thing to return here?
          //.redirect(204, req.baseUrl + req.url)
          .end()
      );
    })
    .catch(next);
});

// Don't let users DELETE their bookmarks?
router.delete('/*', function noDeleteBookmarks(req, res, next) {
  let err = null;

  if (req.url === '/' + req.user['bookmarks_id']) {
    err = new OADAError('Forbidden', 403, 'User cannot delete their bookmarks');
  }

  next(err);
});

router.delete('/*', function deleteLink(req, res, next) {
  // Check if followed a link and are at the root of the linked resource
  if (req.oadaGraph.from['path_leftover'] && !req.oadaGraph['path_leftover']) {
    // Switch to DELETE on parent resource
    let id = req.oadaGraph.from['resource_id'];
    let path = req.oadaGraph.from['path_leftover'];
    req.url = '/' + id.replace(/^\/?resources\//, '') + path;
    req.oadaGraph = req.oadaGraph.from;
    // parent resource DOES exist,
    // but linked resource may or may not have existed
    req.resourceExists = true;
  }

  next();
});

router.delete('/*', function deleteResource(req, res, next) {
  req.log.trace(`Sending DELETE request for request ${req.id}`);
  return requester
    .send(
      {
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
        'if-match': req.get('if-match'),
        //'bodyid': bodyid, // No body means delete?
        //body: req.body
      },
      config.get('kafka:topics:writeRequest')
    )
    .tap(function checkDelete(resp) {
      req.log.trace(`Recieved delete response for request ${req.id}`);
      switch (resp.code) {
        case 'success':
          return;
        case 'not_found':
        // fall-through
        // TODO: Is 403 a good response for DELETE on non-existent?
        case 'permission':
          return Promise.reject(
            new OADAError('Forbidden', 403, 'User does not own this resource')
          );
        case 'if-match failed':
          return Promise.reject(
            new OADAError(
              'Precondition Failed',
              412,
              'If-Match header does not match current resource _rev'
            )
          );
        default:
          let err = new OADAError('delete failed with code ' + resp.code);
          return Promise.reject(err);
      }
    })
    .then(function (resp) {
      return res.set('X-OADA-Rev', resp['_rev']).sendStatus(204);
    })
    .catch(next);
});

function replaceLinks(obj) {
  let ret = Array.isArray(obj) ? [] : {};
  if (!obj) return obj; // no defined objriptors for this level
  return Bluebird.map(Object.keys(obj || {}), (key) => {
    if (key === '*') {
      // Don't put *s into oada. Ignore them
      return;
    }
    let val = obj[key];
    if (typeof val !== 'object' || !val) {
      ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
      return;
    }
    if (val._type) {
      // If it has a '_type' key, don't worry about it.
      //It'll get created in future iterations of ensureTreeExists
      return;
    }
    if (val._id) {
      // If it's an object, and has an '_id', make it a link from descriptor
      ret[key] = { _id: obj[key]._id };
      if (typeof val._rev === 'number') ret[key]._rev = 0;
      return;
    }
    // otherwise, recurse into the object looking for more links
    return replaceLinks(val).then((result) => {
      ret[key] = result;
      return;
    });
  }).then(() => {
    return ret;
  });
}

async function getFromStarredTree(path, tree) {
  if (path === '/' || path === '') return tree;
  let pieces = pointer.parse(path);
  let subTree = tree;
  let starPath = '';
  return Bluebird.each(pieces, (piece, i) => {
    let nextPiece = pointer.has(tree, starPath + '/*') ? '/*' : '/' + piece;
    starPath += nextPiece;
    subTree = pointer.get(tree, starPath);
    return;
  }).then(() => {
    return subTree;
  });
}

module.exports = router;
