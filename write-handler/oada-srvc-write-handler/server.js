'use strict';

var Promise = require('bluebird');
const oadaLib = require('../../libs/oada-lib-arangodb');
const kf = require('kafka-node');
const pointer = require('json-pointer');
const hash = require('object-hash');
const debug = require('debug')('write-handler');
const error = require('debug')('write-handler:error');
const info = require('debug')('write-handler:info');
const trace = require('debug')('write-handler:trace');

var config = require('./config');

var client = new kf.Client(config.get('kafka:broker'), 'http-handler');
var offset = Promise.promisifyAll(new kf.Offset(client));
var producer = Promise.promisifyAll(new kf.Producer(client, {
    partitionerType: 0 //kf.Producer.PARTITIONER_TYPES.keyed
}));
var consumer = new kf.ConsumerGroup({
    host: config.get('kafka:broker'),
    groupId: 'write-handlers',
    fromOffset: 'latest'
}, [config.get('kafka:topics:writeRequest')]);

producer = producer
    .onAsync('ready')
    .return(producer);

consumer.on('message', handleMsg);

function handleMsg(msg) {
    // TODO: Check scope/permission?
    var req = JSON.parse(msg.value);
    req.source = req.source || '';
    var id = req['resource_id'];

    // Get body and check permission in parallel
    var body = Promise.try(function getBody() {
        return req.body || oadaLib.putBodies.getPutBody(req.bodyid);
    }); 
    let existing_resource_info = {};
    var permitted = Promise.try(function checkPermissions() {
        if (req.source === 'rev-graph-update') {
            // no need to check permission for rev graph updates
            return;
        }

        if (id) { // Only run checks if resource exists
            // TODO: Support sharing (i.e., not just owner has permission)
            var start = new Date().getTime();
            info(`Checking permissions of "${id}".`);
            return oadaLib.resources.getResourceOwnerIdRev(id) // { _id, _rev, _meta._owner }
                .then(results => {
                  existing_resource_info = results;
                  var end = new Date().getTime();
                  info(`Got owner (${results._meta._owner}) of "${id}" from arango. +${end-start}ms`);
                    if (existing_resource_info._meta._owner !== req['user_id']) {
                        return Promise.reject(new Error('permission'));
                    }
                });
        }
    });

    var start = new Date().getTime();
    info(`PUTing to "${req['path_leftover']}" in "${id}"`);
    var upsert = Promise.join(body, permitted, function doUpsert(body) {
        var path = req['path_leftover'].replace(/\/*$/, '');
        var obj = {};
        var ts = Date.now();
        // TODO: Sanitize keys?

        // Create new resource
        if (!id) {
            let parts = pointer.parse(path);

            id = 'resources/' + parts[1];
            path = pointer.compile(parts.slice(2));

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
        if (path) {
            pointer.set(obj, path, body);
        } else {
            obj = Object.assign(obj, body);
        }

        // Update meta
        var meta = {
            'modifiedBy': req['user_id'],
            'modified': ts
        };
        obj['_meta'] = Object.assign(obj['_meta'] || {}, meta);

        // Precompute new rev: using only the body so that subsequent PUT's 
        var rev = msg.offset + '-' + hash(JSON.stringify(body), {algorithm: 'md5'});

        // If the hash part of the rev is identical to last time, don't re-execute a PUT to keep it idempotent
        existing_resource_info._rev = existing_resource_info._rev || '0-0';
        const old_rev_hash = existing_resource_info._rev.split('-')[1];
        const new_rev_hash = rev.split('-')[1];
        if (old_rev_hash === new_rev_hash) {
          info('PUT would result in same rev hash as the current one, skipping write.');
          return rev;
        } else {
          trace('PUT is a new hash ('+new_rev_hash+', old = '+ old_rev_hash+ '), performing write');
        }

        obj['_rev'] = rev;
        pointer.set(obj, '/_meta/_rev', rev);

        // Compute new change
        var change = {
            '_id': id + '/_meta/_changes',
            '_rev': rev,
            [rev]: {
                'merge': Object.assign({}, obj),
                'userId': req['user_id'],
                'authorizationID': req['authorizationid']
            },
        };
        obj['_meta'] = Object.assign({'_changes': change}, obj['_meta']);

        // Update rev of meta?
        obj['_meta']['_rev'] = rev;

        return oadaLib.resources.putResource(id, obj).return(rev);
    }).then(function respond(rev) {
        var end = new Date().getTime();
        info(`Finished PUTing to "${req['path_leftover']}". + ${end-start}ms`);
        return producer.call('sendAsync', [{
            topic: config.get('kafka:topics:httpResponse'),
            partition: req['resp_partition'],
            messages: JSON.stringify({
                'msgtype': 'write-response',
                'code': 'success',
                'resource_id': id,
                '_rev': rev,
                'user_id': req['user_id'],
                'authorizationid': req['authorizationid'],
                'connection_id': req['connection_id'],
            })
        }]);
    }).catch(function respondErr(err) {
        error(err);
        return producer.call('sendAsync', [{
            topic: config.get('kafka:topics:httpResponse'),
            partition: req['resp_partition'],
            messages: JSON.stringify({
                'msgtype': 'write-response',
                'code': err.message || 'error',
                'user_id': req['user_id'],
                'authorizationid': req['authorizationid'],
                'connection_id': req['connection_id'],
            })
        }]);
    });

    var cleanup = body.then(() => {
        // Remove putBody, if there was one
        return req.bodyid && oadaLib.putBodies.removePutBody(req.bodyid);
    });
    return Promise.join(upsert, cleanup);
}
