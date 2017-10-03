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
const info = debug('sync-handler:info');
const trace = debug('sync-handler:trace');
const error = debug('sync-handler:error');

const Promise = require('bluebird');
const URL = require('url');
const {Responder} = require('../../libs/oada-lib-kafka');
const {resources, remoteResources} = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');

// TODO: Where to store the syncs?
// I feel like putting webhooks in _syncs was a poor choice
const META_KEY = '_remote_syncs';

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
        config.get('kafka:topics:httpResponse'),
        null,
        'sync-handlers');

module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', async function handleReq(req) {
    if (req.msgtype !== 'write-response') {
        return;
    }
    if (req.code !== 'success') {
        return;
    }

    let id = req['resource_id'];
    let rev = req['_rev'];
    // TODO: Add AQL query for just syncs and newest change?
    let syncs = await resources.getResource(id, `/_meta/${META_KEY}`)
        .then(syncs => syncs || {})
        .then(Object.entries);

    if (syncs.length === 0) {
        // Nothing for us to do
        return;
    }

    // TODO: Figure out just what changed
    let ids = resources.getNewDescendants(id, '0-0');
    let changes = await ids.map(id => ({[id]: resources.getResource(id)}))
        .reduce(Object.assign);

    let puts = Promise.map(syncs, async ([key, sync]) => {
        info(`Running sync ${key} for resource ${id}`);
        let domain = sync.domain;
        // TODO: Cache this?
        let apiroot = Promise.resolve(axios({
            method: 'get',
            url: `https://${domain}/.well-known/oada-configuration`
        })).get('data').get('oada_base_uri').then(s => s.replace(/\/?$/, '/'));

        // Ensure each local resource has a corresponding remote one
        let rids = remoteResources.getRemoteId(await ids, domain)
            .map(async rid => {
                if (rid.rid) {
                    return rid;
                }

                let url = `${await apiroot}resources/`;
                let type = (await changes[rid.id])['_meta']['_type'];
                // Create any missing remote IDs
                let loc = await Promise.resolve(axios({
                    method: 'post',
                    data: {},
                    headers: {
                        'content-type': type,
                        authorization: sync.token
                    },
                    url
                })).get('headers').get('location');

                // Parse resource ID from Location header
                let newid = URL.resolve(url, loc).replace(url, 'resources/');

                let newrid = {
                    rid: newid,
                    id: rid.id
                };

                // Record new remote ID
                // TODO: Insert all new remoteResources at once?
                await remoteResources.addRemoteId(newrid, domain);

                return newrid;
            });

        return rids.map(async rid => {
            // TODO: Only send what is new
            let change = await changes[rid.id];
            // TODO: Fix links
            let body = Object.assign({}, change, {'_meta': undefined});
            let type = change['_meta']['_type'];
            // TODO: Support DELETE
            return axios({
                method: 'put',
                url: `${await apiroot}${rid.rid}`,
                data: body,
                headers: {
                    'content-type': type,
                    authorization: sync.token
                }
            });
        });
    });

    // TODO: Handle sync url
    await puts;
});
