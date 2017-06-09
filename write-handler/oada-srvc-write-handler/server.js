'use strict';

var Promise = require('bluebird');
const oadaLib = require('../../libs/oada-lib-arangodb');
const kf = require('kafka-node');
const pointer = require('json-pointer');
const hash = require('object-hash');
const debug = require('debug')('write-handler');
const error = require('debug')('write-handler:error');
const info = require('debug')('write-handler:info');

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
    var permitted = Promise.try(function checkPermissions() {
        if (req.source === 'rev-graph-update') {
            // no need to check permission for rev graph updates
            return;
        }

        if (id) { // Only run checks if resource exists
            // TODO: Support sharing (i.e., not just owner has permission)
            var start = new Date().getTime();
            info(`Checking permissions of "${id}".`);
            return oadaLib.resources.getResource(id, '_meta/_owner')
                .then(function checkOwner(owner) {
                  var end = new Date().getTime();
                  info(`Got owner of "${id}" from arango. +${end-start}ms`);
                    if (owner !== req['user_id']) {
                        return Promise.reject(new Error('permission'));
                    }
                });
        }
    });

    var start = new Date().getTime();
    info(`PUTing to "${req['path_leftover']}" in "${id}"`);
    var upsert = Promise.join(body, permitted, function doUpsert(body) {
        var path = pointer.parse(req['path_leftover'].replace(/\/*$/, ''));
        var obj = {};
        var ts = Date.now();
        // TODO: Sanitize keys?

        // Create new resource
        if (!id) {
            id = 'resources/' + parts[1];
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
                    o[k] = {}
                }
                o = o[k];
            });

            o[endk] = body;
        } else {
            obj = Object.assign(body, obj);
        }

        // Update meta
        var meta = {
            'modifiedBy': req['user_id'],
            'modified': ts
        };
        obj['_meta'] = Object.assign(obj['_meta'] || {}, meta);

        // Precompute new rev
        var rev = msg.offset + '-' + hash(obj, {algorithm: 'md5'});
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
