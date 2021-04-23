'use strict';

const Bluebird = require('bluebird');
const { resources, putBodies, changes } = require('@oada/lib-arangodb');
const { Responder } = require('@oada/lib-kafka');
const pointer = require('json-pointer');
const debug = require('debug');
const error = debug('write-handler:error');
const info = debug('write-handler:info');
const trace = debug('write-handler:trace');
const Cache = require('timed-cache');
const objectAssignDeep = require('object-assign-deep');

let counter = 0;

const config = require('./config');

const responder = new Responder({
  consumeTopic: config.get('kafka:topics:writeRequest'),
  produceTopic: config.get('kafka:topics:httpResponse'),
  group: 'write-handlers',
});

// Only run one write at a time?
const locks = {}; // Per-resource write locks/queues
const cache = new Cache({ defaultTtl: 60 * 1000 });
responder.on('request', (req, ...rest) => {
  if (counter++ > 500) {
    counter = 0;
    global.gc();
  }
  let id;
  id = req['resource_id'].replace(/^\//, '');
  let p = locks[id] || Bluebird.resolve();
  var pTime = Date.now() / 1000;
  // Run once last write finishes (whether it worked or not)
  p = p
    .catch(() => {})
    .then(() => handleReq(req, ...rest))
    .finally(() => {
      // Clean up if queue empty
      if (locks[id] === p) {
        // Our write has finished AND no others queued for this id
        delete locks[id];
      }
    })
    .tap(() => {
      trace('handleReq %d', Date.now() / 1000 - pTime);
    });
  locks[id] = p;
  return p;
});

function handleReq(req) {
  req.source = req.source || '';
  req.resourceExists = req.resourceExists ? req.resourceExists : false; // Fixed bug if this is undefined
  var id = req['resource_id'].replace(/^\//, '');

  // Get body and check permission in parallel
  var getB = Date.now() / 1000;
  info('Handling %s', id);
  var body = Bluebird.try(function getBody() {
    var pb = Date.now() / 1000;
    if (req.bodyid) {
      return putBodies
        .getPutBody(req.bodyid)
        .tap(() => trace('getPutBody %d', Date.now() / 1000 - pb));
    }
    return req.body;
  });
  trace('getBody %d', Date.now() / 1000 - getB);

  trace(`PUTing to "%s" in "%s"`, req['path_leftover'], id);

  var changeType;
  var beforeUpsert = Date.now() / 1000;
  var upsert = body
    .then(async function doUpsert(body) {
      trace('FIRST BODY %O', body);
      trace('doUpsert %d', Date.now() / 1000 - beforeUpsert);
      if (req['if-match']) {
        const rev = await resources.getResource(req['resource_id'], '_rev');
        if (req['if-match'] !== rev) {
          error(rev);
          error(req['if-match']);
          error(req);
          throw new Error('if-match failed');
        }
      }
      if (req['if-none-match']) {
        const rev = await resources.getResource(req['resource_id'], '_rev');
        if (req['if-none-match'].includes(rev)) {
          error(rev);
          error(req['if-none-match']);
          error(req);
          throw new Error('if-none-match failed');
        }
      }
      var beforeCacheRev = Date.now() / 1000;
      let cacheRev = cache.get(req['resource_id']);
      if (!cacheRev) {
        cacheRev = await resources.getResource(req['resource_id'], '_rev');
      }
      if (req.rev) {
        if (cacheRev !== req.rev) {
          throw new Error('rev mismatch');
        }
      }
      trace('cacheRev %d', Date.now() / 1000 - beforeCacheRev);

      var beforeDeletePartial = Date.now() / 1000;
      var path = pointer.parse(
        req['path_leftover'].replace(/\/*$/, '')
      ); /* comment so syntax highlighting is ok */
      let method = resources.putResource;
      changeType = 'merge';

      // Perform delete
      if (body === undefined) {
        trace('Body is undefined, doing delete');
        if (path.length > 0) {
          trace('Delete path = %s', path);
          // TODO: This is gross
          let ppath = Array.from(path);
          method = (id, obj) => resources.deletePartialResource(id, ppath, obj);
          trace(
            `Setting method = deletePartialResource(${id}, ${ppath}, ${obj})`
          );
          body = null;
          changeType = 'delete';
          trace(`Setting changeType = 'delete'`);
        } else {
          if (!req.resourceExists)
            return { rev: undefined, orev: undefined, changeId: undefined };
          trace('deleting resource altogether');
          return resources
            .deleteResource(id)
            .tap(() =>
              trace(
                'deleteResource %d',
                Date.now() / 1000 - beforeDeletePartial
              )
            );
        }
      }

      var obj = {};
      var ts = Date.now() / 1000;
      // TODO: Sanitize keys?

      trace(
        '%s: Checking if resource exists (req.resourceExists = %o)',
        req.resource_id,
        req.resourceExists
      );
      if (req.resourceExists === false) {
        trace(
          'initializing arango: resource_id = ' +
            req.resource_id +
            ', path_leftover = ' +
            req.path_leftover
        );
        id = req.resource_id.replace(/^\//, '');
        path = path.slice(2);

        // Initialize resource stuff
        obj = {
          _type: req['contentType'],
          _meta: {
            _id: id + '/_meta',
            _type: req['contentType'],
            _owner: req['user_id'],
            stats: {
              createdBy: req['user_id'],
              created: ts,
            },
          },
        };
        trace('Intializing resource with %O', obj);
      }

      // Create object to recursively merge into the resource
      trace(`Recursively merging path into arango object, path = ${path}`);
      if (path.length > 0) {
        let o = obj;
        let endk = path.pop();
        path.forEach((k) => {
          trace(`Adding path for key ${k}`);
          if (!(k in o)) {
            // TODO: Support arrays better?
            o[k] = {};
          }
          o = o[k];
        });
        o[endk] = body;
      } else {
        obj = objectAssignDeep(obj, body);
      }
      trace('Setting body on arango object to %O', obj);

      trace('recursive merge %d', Date.now() / 1000 - ts);

      // Update meta
      var meta = {
        modifiedBy: req['user_id'],
        modified: ts,
      };
      obj['_meta'] = objectAssignDeep(obj['_meta'] || {}, meta);

      // Increment rev number
      let rev = parseInt(cacheRev || 0, 10) + 1;

      // If rev is supposed to be set to 1, this is a "new" resource.  However,
      // change feed could still be around from an earlier delete, so check that
      // and set rev to more than biggest one
      if (rev === 1) {
        const changerev = await changes.getMaxChangeRev(id);
        if (changerev && changerev > 1) {
          rev = +changerev + 1;
          trace(
            `Found old changes (max rev ${changerev}) for new resource, setting initial _rev to ${rev} include them`
          );
        }
      }

      obj['_rev'] = rev;
      pointer.set(obj, '/_meta/_rev', rev);

      // Compute new change
      var beforeChange = Date.now() / 1000;
      let children = req['from_change_id'] || [];
      trace('Putting change, "change" = %O', obj);
      let changeId = await changes.putChange({
        change: obj,
        resId: id,
        rev,
        type: changeType,
        children,
        path: req['change_path'],
        userId: req['user_id'],
        authorizationId: req['authorizationid'],
      });
      trace('change_id %d', Date.now() / 1000 - beforeChange);
      var beforeMethod = Date.now() / 1000;
      pointer.set(obj, '/_meta/_changes', {
        _id: id + '/_meta/_changes',
        _rev: rev,
      });

      // Update rev of meta?
      obj['_meta']['_rev'] = rev;

      return Bluebird.resolve(method(id, obj, !req.ignoreLinks))
        .then((orev) => ({ rev, orev, changeId }))
        .tap(() => trace('method %d', Date.now() / 1000 - beforeMethod));
    })
    .then(function respond({ rev, orev, changeId }) {
      trace('upsert then %d', Date.now() / 1000 - beforeUpsert);
      var beforeCachePut = Date.now() / 1000;
      // Put the new rev into the cache
      cache.put(id, rev);
      trace('cache.put %d', Date.now() / 1000 - beforeCachePut);

      const res = {
        msgtype: 'write-response',
        code: 'success',
        resource_id: id,
        _rev: typeof rev === 'number' ? rev : 0,
        _orev: orev,
        user_id: req['user_id'],
        authorizationid: req['authorizationid'],
        path_leftover: req['path_leftover'],
        contentType: req['contentType'],
        indexer: req['indexer'],
        change_id: changeId,
      };
      // causechain comes from rev-graph-update
      if (req.causechain) res.causechain = req.causechain; // pass through causechain if present
      return res;
    })
    .catch(resources.NotFoundError, function respondNotFound(err) {
      error(err);
      return {
        msgtype: 'write-response',
        code: 'not_found',
        user_id: req['user_id'],
        authorizationid: req['authorizationid'],
      };
    })
    .catch(function respondErr(err) {
      error(err);
      return {
        msgtype: 'write-response',
        code: err.message || 'error',
        user_id: req['user_id'],
        authorizationid: req['authorizationid'],
      };
    });

  var beforeCleanUp = Date.now() / 1000;
  var cleanup = body.then(() => {
    trace('cleanup %d', Date.now() / 1000 - beforeCleanUp);
    var beforeRPB = Date.now() / 1000;
    // Remove putBody, if there was one
    // const result = req.bodyid && putBodies.removePutBody(req.bodyid);
    return (
      req.bodyid &&
      putBodies
        .removePutBody(req.bodyid)
        .tap(() => trace('remove Put Body %d', Date.now() / 1000 - beforeRPB))
    );
  });
  var beforeJoin = Date.now() / 1000;
  return Bluebird.join(upsert, cleanup, (resp) => resp).tap(() =>
    trace('join %d', Date.now() / 1000 - beforeJoin)
  );
}
