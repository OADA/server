'use strict';

const OADAError = require('oada-error').OADAError;
const Promise = require('bluebird');
const {resources, putBodies, changes} = require('../../libs/oada-lib-arangodb');
const {Responder} = require('../../libs/oada-lib-kafka');
const pointer = require('json-pointer');
const nhash = require('node-object-hash')();
const error = require('debug')('write-handler:error');
const info = require('debug')('write-handler:info');
const Cache = require('timed-cache');

let counter = 0;

var config = require('./config');

var responder = new Responder({
    consumeTopic: config.get('kafka:topics:writeRequest'),
    produceTopic: config.get('kafka:topics:httpResponse'),
    group: 'write-handlers'
});

// Only run one write at a time?
let locks = {}; // Per-resource write locks/queues
let cache = new Cache({defaultTtl: 60 * 1000});
responder.on('request', (req, ...rest) => {
    if (counter++ > 500) {
        counter = 0;
        global.gc();
    }

    let id = req['resource_id'];
    let p = locks[id] || Promise.resolve();
    var pTime = Date.now() / 1000;
    // Run once last write finishes (whether it worked or not)
    p = p.catch(() => {})
        .then(() => handleReq(req, ...rest))
        .finally(() => { // Clean up if queue empty
            if (locks[id] === p) {
                // Our write has finished AND no others queued for this id
                delete locks[id];
            }
        })
        .tap(() => {
            info('handleReq', Date.now() / 1000 - pTime);
            info('~~~~~~~~~~~~~~~~~~~~~~~~');
            info('~~~~~~~~~~~~~~~~~~~~~~~~');
        });
    locks[id] = p;
    return p;
});

function handleReq(req, msg) {

    req.source = req.source || '';
    var id = req['resource_id'];

    // Get body and check permission in parallel
    var getB = Date.now() / 1000;
    var body = Promise.try(function getBody() {
        var pb = Date.now() / 1000;
        return req.body || req.bodyid && putBodies.getPutBody(req.bodyid)
            .tap(() => info('getPutBody', Date.now() / 1000 - pb));
    });
    let existingResourceInfo = {};
    info('getBody', Date.now() / 1000 - getB);

    info(`PUTing to "${req['path_leftover']}" in "${id}"`);

    var changeType;
    var beforeUpsert = Date.now() / 1000;
    var upsert = body.then(async function doUpsert(body) {
        info('doUpsert', Date.now() / 1000 - beforeUpsert);
        if (req['if-match']) {
            let rev = await resources.getResource(req['resource_id'], '_rev');
            if (parseInt(req['if-match']) !== rev) {
                throw new Error('if-match failed');
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
        info('cacheRev', Date.now() / 1000 - beforeCacheRev);

        var beforeDeletePartial = Date.now() / 1000;
        var path = pointer.parse(req['path_leftover'].replace(/\/*$/, ''));
        let method = resources.putResource;
        changeType = 'merge';
        // Perform delete
        if (body === undefined) {
            if (path.length > 0) {
                // TODO: This is gross
                let ppath = Array.from(path);
                method = (id, obj) =>
                    resources.deletePartialResource(id, ppath, obj);
                body = null;
                changeType = 'delete';
            } else {
                return resources.deleteResource(id).tap(() =>
                    info('deleteResource',
                            Date.now() / 1000 - beforeDeletePartial));
            }
        }

        var obj = {};
        var ts = Date.now() / 1000;
        // TODO: Sanitize keys?

        // Create new resource
        if (!id) {
            id = 'resources/' + path[1];
            path = path.slice(2);

            // Initialize resource stuff
            obj = {
                '_type': req['contentType'],
                '_meta': {
                    '_id': id + '/_meta',
                    '_type': req['contentType'],
                    '_owner': req['user_id'],
                    'stats': {
                        'createdBy': req['user_id'],
                        'created': ts
                    },
                }
            };
        }

        // Create object to recursively merge into the resource
        if (path.length > 0) {
            let o = obj;

            let endk = path.pop();
            path.forEach(k => {
                if (!(k in o)) {
                    // TODO: Support arrays better?
                    o[k] = {};
                }
                o = o[k];
            });

            o[endk] = body;
        } else {
            obj = Object.assign(obj, body);
        }

        info('recursive merge', Date.now() / 1000 - ts);

        var beforeHash = Date.now() / 1000;
        // Precompute new rev ignoring _meta and such
        //let newRevHash = hash(JSON.stringify(obj), {algorithm: 'md5'});
        let newRevHash = nhash.hash(obj);

        // Update meta
        var meta = {
            'modifiedBy': req['user_id'],
            'modified': ts
        };
        obj['_meta'] = Object.assign(obj['_meta'] || {}, meta);

        // Increment rev number
        let rev = parseInt(cacheRev || 0, 10) + 1;

        // If the hash part of the rev is identical to last time,
        // don't re-execute a PUT to keep it idempotent
        /*
        existingResourceInfo['_rev'] = (typeof existingResourceInfo === 'number' ? existingResourceInfo['_rev'] : 0);
        const oldRevHash = existingResourceInfo['_rev'].split('-')[1];
        if (oldRevHash === newRevHash) {
            return rev;
        }
        */

        obj['_rev'] = rev;
        pointer.set(obj, '/_meta/_rev', rev);
        info('hash', Date.now() / 1000 - beforeHash);

        // Compute new change
        var beforeChange = Date.now() / 1000;
        let changeId = await changes.putChange({
            change: obj,
            resId: id,
            rev,
            type: changeType,
            child: req['from_change_id'],
            path: req['change_path'],
            userId: req['user_id'],
            authorizationId: req['authorizationid'],
        });
        info('change_id', Date.now() / 1000 - beforeChange);
        var beforeMethod = Date.now() / 1000;
        pointer.set(obj, '/_meta/_changes', {
            _id: id + '/_meta/_changes',
            _rev: rev
        });
        //        let change_id = '132';

        // Update rev of meta?
        obj['_meta']['_rev'] = rev;

        //return {rev, orev: 'c', change_id};

        return Promise.resolve(method(id, obj)).then(orev => ({rev, orev, changeId}))
            .tap(() => info('method', Date.now() / 1000 - beforeMethod));
    }).then(function respond({rev, orev, changeId}) {
        info('upsert then', Date.now() / 1000 - beforeUpsert);
        var beforeCachePut = Date.now() / 1000;
        // Put the new rev into the cache
        cache.put(id, rev);
        info('cache.put', Date.now() / 1000 - beforeCachePut);

        return {
            'msgtype': 'write-response',
            'code': 'success',
            'resource_id': id,
            '_rev': (typeof rev === 'number' ? rev : 0),
            '_orev': orev,
            'user_id': req['user_id'],
            'authorizationid': req['authorizationid'],
            'path_leftover': req['path_leftover'],
            'contentType': req['contentType'],
            'indexer': req['indexer'],
            'change_id': changeId,
        };
    }).catch(resources.NotFoundError, function respondNotFound(err) {
        error(err);
        return {
            'msgtype': 'write-response',
            'code': 'not_found',
            'user_id': req['user_id'],
            'authorizationid': req['authorizationid'],
        };
    }).catch(function respondErr(err) {
        error(err);
        return {
            'msgtype': 'write-response',
            'code': err.message || 'error',
            'user_id': req['user_id'],
            'authorizationid': req['authorizationid'],
        };
    });

    var beforeCleanUp = Date.now() / 1000;
    var cleanup = body.then(() => {
        info('cleanup', Date.now() / 1000 - beforeCleanUp);
        var beforeRPB = Date.now() / 1000;
        // Remove putBody, if there was one
        // const result = req.bodyid && putBodies.removePutBody(req.bodyid);
        return req.bodyid && putBodies.removePutBody(req.bodyid)
            .tap(() => info('remove Put Body', Date.now() / 1000 - beforeRPB));
    });
    var beforeJoin = Date.now() / 1000;
    return Promise.join(upsert, cleanup, resp => resp)
        .tap(() => info('join', Date.now() / 1000 - beforeJoin));
}
