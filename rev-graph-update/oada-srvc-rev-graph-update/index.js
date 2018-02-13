/* Copyright 2017 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const debug = require('debug');
const trace = debug('rev-graph-update:trace');
const info = debug('rev-graph-update:info');
const warn = debug('rev-graph-update:warn');
const error = debug('rev-graph-update:error');

const Promise = require('bluebird');
// const kf = require('kafka-node');
const {ReResponder} = require('../../libs/oada-lib-kafka');
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');

//---------------------------------------------------------
// Kafka intializations:
const responder = new ReResponder({
    consumeTopic: config.get('kafka:topics:httpResponse'),
    produceTopic: config.get('kafka:topics:writeRequest'),
    group: 'rev-graph-update'
});

module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', function handleReq(req) {
    if (!req || req.msgtype !== 'write-response') {
        return []; // not a write-response message, ignore it
    }
    if (req.code !== 'success') {
        return [];
    }
    if (typeof req['resource_id'] === 'undefined' ||
            typeof req['_rev'] === 'undefined') {
        throw new Error(`Invalid http_response: there is either no resource_id or _rev.  respose = ${JSON.stringify(req)}`);
    }
    if (typeof req['user_id'] === 'undefined') {
        warn('Received message does not have user_id');
    }
    if (typeof req.authorizationid === 'undefined') {
        warn('Received message does not have authorizationid');
    }

    // setup the write_request msg
    const res = {
        'connection_id': null, // TODO: Fix ReResponder for multiple responses?
        'type': 'write_request',
        'resource_id': null,
        'path': null,
        'contentType': null,
        'body': null,
        'url': '',
        'user_id': req['user_id'],
        'from_change_id': req.change_id,
        'authorizationid': req.authorizationid
    };

    info(`finding parents for resource_id = ${req['resource_id']}`);

    // find resource's parent
    return oadaLib.resources.getParents(req['resource_id'])
        .then(p => {
            if (!p || p.length === 0) {
                warn(`${req['resource_id']} does not have a parent.`);
                return undefined;
            }

            trace('the parents are: ', p);

            // TODO: Real cycle detection
            if (p.some(p => p['resource_id'] === req['resource_id'])) {
                let err = new Error(`${req['resource_id']} is its own parent!`);
                return Promise.reject(err);
            }

            return Promise.map(p, item => {
                trace('parent resource_id = ', item['resource_id']);
                trace('parent path = ', item['path']);
                let msg = Object.assign({}, res);
                msg['change_path'] = item['path']
                msg['resource_id'] = item['resource_id'];
                msg['path_leftover'] = item.path + '/_rev';
                msg.contentType = item.contentType;
                msg.body = req['_rev'];

                trace('trying to produce: ', msg);

                return msg;
            });
        })
        .tapCatch(err => {
            error(err);
        });
});

