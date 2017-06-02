'use strict';

var Promise = require('bluebird');
const oadaLib = require('../../libs/oada-lib-arangodb');
const kf = require('kafka-node');
const pointer = require('json-pointer');
const hash = require('object-hash');
const debug = require('debug')('write-handler');
const error = require('debug')('write-handler:error');
const util = require('util');

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

    // TODO: Handle new resource
    return Promise.try(function() {
        var path = req['path_leftover'].replace(/\/*$/, '');
        var id = req['resource_id'].replace(/^\/?resources\//, '');
        var obj = {};
        var ts = Date.now();

        // TODO: Sanitize keys?

        // Create new resource
        if (!id) {
            let parts = pointer.parse(path);

            id = parts[1];
            path = pointer.compile(parts.slice(2));

            // Initialize resource stuff
            obj = {
                '_type': req['content_type'],
                '_meta': {
                    '_id': 'resources/' + id + '/_meta',
                    '_type': req['content_type'],
                    '_owner': req['user_id'],
                    'stats': {
                        'createdBy': req['user_id'],
                        'created': ts
                    },
                }
            };
        }

        debug(`PUTing to "${path}" in resource "${id}"`);
        // Create object to recursively merge into the resource
        if (path) {
            pointer.set(obj, path, req.body);
        } else {
            obj = Object.assign(req.body, obj);
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
            '_id': 'resources/' + id + '/_meta/_changes',
            '_rev': rev,
            [rev]: {
                'merge': Object.assign({}, obj),
                'userId': req['user_id'],
                'authorizationID': 'DEADBEEF' // TODO: Do this
            },
        };
        obj['_meta'] = Object.assign({'_changes': change}, obj['_meta']);

        // Update rev of meta?
        obj['_meta']['_rev'] = rev;

        return oadaLib.resources.putResource(id, obj)
            .then(function respond() {
                return producer.call('sendAsync', [{
                    topic: config.get('kafka:topics:httpResponse'),
                    partition: req['resp_partition'],
                    messages: JSON.stringify({
                        'code': 'success',
                        'resource_id': 'resources/' + id,
                        '_rev': rev,
                        'connection_id': req['connection_id'],
                    })
                }]);
            });
    }).catch(function respondErr(err) {
        error(err);
        return producer.call('sendAsync', [{
            topic: config.get('kafka:topics:httpResponse'),
            partition: req['resp_partition'],
            messages: JSON.stringify({
                'code': 'error',
                'connection_id': req['connection_id'],
            })
        }]);
    });
}
