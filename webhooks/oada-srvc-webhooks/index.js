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
const trace = debug('webhooks:trace');
const error = debug('webhooks:error');

var Promise = require('bluebird');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
            config.get('kafka:topics:httpResponse'),
            null,
            'webhooks');

module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', function handleReq(req) {
    if (req.msgtype !== 'write-response') {
        return;
    }
    if (req.code !== 'success') {
        return;
    }
    // TODO: Add AQL query for just syncs and newest change?
    return oadaLib.resources.getResource(req.resource_id, '/_meta')
        .then(meta => {
            if (meta && meta._syncs) {
                return Promise.map(Object.keys(meta._syncs), (sync) => {
                    if (meta._syncs[sync]['oada-put']) {
                        trace('Sending oada-put to: ' + meta._syncs[sync].url);
                        let change = meta._changes[req._rev];
                        let body = change.merge || change.delete;
                        trace('oada-put body: ', body);
                        return axios({
                            method: change.delete ? 'delete' : 'put',
                            url: meta._syncs[sync].url,
                            data: body,
                            headers: meta._syncs[sync].headers,
                        });
                    }
                    trace('Sending to: ' + meta._syncs[sync].url);
                    return axios(meta._syncs[sync]);
                });
            }
        })
        .then(() => {})
        .tapCatch(error);
});
