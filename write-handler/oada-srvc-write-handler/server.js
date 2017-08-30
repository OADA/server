'use strict';

var Promise = require('bluebird');
const resources = require('../../libs/oada-lib-arangodb').resources;
const putBodies = require('../../libs/oada-lib-arangodb').putBodies;
const Responder = require('../../libs/oada-lib-kafka').Responder;
const pointer = require('json-pointer');
const hash = require('object-hash');
const error = require('debug')('write-handler:error');
const info = require('debug')('write-handler:info');
const trace = require('debug')('write-handler:trace');

var config = require('./config');

var responder = new Responder(
    config.get('kafka:topics:writeRequest'),
    config.get('kafka:topics:httpResponse'),
    'write-handlers'
);

responder.on('request', function handleReq(req, msg) {
    // TODO: Check scope/permission?
    req.source = req.source || '';
    var id = req['resource_id'];

    // Get body and check permission in parallel
    var body = Promise.try(function getBody() {
        return req.body || req.bodyid && putBodies.getPutBody(req.bodyid);
    });
    let existingResourceInfo = {};
    var permitted = Promise.try(function checkPermissions() {
        if (req.source === 'rev-graph-update') {
            // no need to check permission for rev graph updates
            return;
        }

        if (id) { // Only run checks if resource exists
            // TODO: Support sharing (i.e., not just owner has permission)
            var start = new Date().getTime();
            info(`Checking permissions of "${id}".`);
            // { _id, _rev, _meta._owner }
            return resources.getResourceOwnerIdRev(id).then(results => {
                existingResourceInfo = results;
                var end = new Date().getTime();
                info(`Got owner (${results._meta._owner}) of "${id}"` +
                        ` from arango. +${end - start}ms`);
                if (existingResourceInfo._meta._owner !== req['user_id']) {
                    return Promise.reject(new Error('permission'));
                }
            });
        }
    });

    var start = new Date().getTime();
    info(`PUTing to "${req['path_leftover']}" in "${id}"`);
    var upsert = Promise.join(body, permitted, function doUpsert(body) {
        var path = pointer.parse(req['path_leftover'].replace(/\/*$/, ''));

        let method = resources.putResource;
        let changeType = 'merge';
        // Perform delete
        // TODO: Should deletes be a separate topic?
        if (body === undefined) {
            // TODO: How to handle rev etc. on DELETE?
            if (path.length > 0) {
                // TODO: This is gross
                let ppath = Array.from(path);
                method = (id, obj) =>
                        resources.deletePartialResource(id, ppath, obj);
                body = null;
                changeType = 'delete';
            } else {
                return resources.deleteResource(id);
            }
        }

        var obj = {};
        var ts = Date.now();
        // TODO: Sanitize keys?

        // Create new resource
        if (!id) {
            id = 'resources/' + path[1];
            path = path.slice(2);

            // Initialize resource stuff
            obj = {
                '_type': req['content_type'],
                '_meta': {
                    '_id': id + '/_meta',
                    '_type': req['content_type'],
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

        // Precompute new rev ignoring _meta and such
        let newRevHash = hash(JSON.stringify(obj), {algorithm: 'md5'});

        // Update meta
        var meta = {
            'modifiedBy': req['user_id'],
            'modified': ts
        };
        obj['_meta'] = Object.assign(obj['_meta'] || {}, meta);

        var rev = msg.offset + '-' + newRevHash;

        // If the hash part of the rev is identical to last time,
        // don't re-execute a PUT to keep it idempotent
        existingResourceInfo._rev = existingResourceInfo._rev || '0-0';
        const oldRevHash = existingResourceInfo._rev.split('-')[1];
        if (oldRevHash === newRevHash) {
            info('PUT would result in same rev hash as the current one,' +
                    ' skipping write.');
            return rev;
        } else {
            trace(`PUT is a new hash (${newRevHash}, old = ${oldRevHash}),` +
                    ' performing write');
        }

        obj['_rev'] = rev;
        pointer.set(obj, '/_meta/_rev', rev);

        // Compute new change
        var change = {
            '_id': id + '/_meta/_changes',
            '_rev': rev,
            [rev]: {
                [changeType]: Object.assign({}, obj),
                'userId': req['user_id'],
                'authorizationID': req['authorizationid']
            },
        };
        obj['_meta'] = Object.assign({'_changes': change}, obj['_meta']);

        // Update rev of meta?
        obj['_meta']['_rev'] = rev;

        return method(id, obj).return(rev);
    }).then(function respond(rev) {
        var end = new Date().getTime();
        info(`Finished PUTing to "${req['path_leftover']}". +${end - start}ms`);
        return {
            'msgtype': 'write-response',
            'code': 'success',
            'resource_id': id,
            '_rev': rev,
            'user_id': req['user_id'],
			'authorizationid': req['authorizationid'],
			'path_leftover': req['path_leftover'],
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

    var cleanup = body.then(() => {
        // Remove putBody, if there was one
        return req.bodyid && putBodies.removePutBody(req.bodyid);
    });

    return Promise.join(upsert, cleanup, resp => resp);
});
