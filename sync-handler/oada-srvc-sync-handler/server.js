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
const warn = debug('sync-handler:warn');
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
    //let rev = req['_rev'];
    let orev = req['_orev'];
    // TODO: Add AQL query for just syncs and newest change?
    let syncs = await resources.getResource(id, `/_meta/${META_KEY}`)
        .then(syncs => syncs || {})
        .then(Object.entries)
        // Ignore sync entries that aren't objects
        .filter(sync => sync[1] && typeof sync[1] === 'object');

    if (syncs.length === 0) {
        // Nothing for us to do
        return;
    }

    let desc = resources.getNewDescendants(id, orev);
    // TODO: Figure out just what changed
    let changes = await desc.filter(d => d.changed)
        .map(d => ({[d.id]: resources.getResource(d.id)}))
        .reduce((a, b) => Object.assign(a, b));

    // TODO: Probably should not be keeping the tokens under _meta...
    let puts = Promise.map(syncs, async ([key, {url, domain, token}]) => {
        info(`Running sync ${key} for resource ${id}`);
        // Need separate changes map for each sync since they run concurently
        let lchanges = Object.assign({}, changes); // Shallow copy

        if (process.env.NODE_ENV !== 'production') {
            /*
                If running in dev environment localhost should
                be directed to the proxy server
            */
            domain = domain.replace('localhost', 'proxy');
        }

        // TODO: Cache this?
        let apiroot = Promise.resolve(axios({
            method: 'get',
            url: `https://${domain}/.well-known/oada-configuration`
        })).get('data').get('oada_base_uri').then(s => s.replace(/\/?$/, '/'));

        // Ensure each local resource has a corresponding remote one
        let ids = await desc.map(d => d.id);
        let rids = await remoteResources.getRemoteId(ids, domain)
            .map(rid => rid.id === id ? {id: id, rid: url} : rid)
            .map(async ({id, rid}) => {
                if (rid) {
                    return {id, rid};
                }

                let url = `${await apiroot}resources/`;
                let type = (await lchanges[id])['_meta']['_type'];
                // Create any missing remote IDs
                let loc = await Promise.resolve(axios({
                    method: 'post',
                    data: {},
                    headers: {
                        'content-type': type,
                        authorization: token
                    },
                    url
                })).get('headers').get('location');

                // Parse resource ID from Location header
                let newid = URL.resolve(url, loc).replace(url, 'resources/');

                let newrid = {
                    rid: newid,
                    id: id
                };

                // Record new remote ID
                // TODO: Insert all new remoteResources at once?
                await remoteResources.addRemoteId(newrid, domain);

                // TODO: Less gross way of create new remote resources?
                lchanges[id] = resources.getResource(id);

                return newrid;
            });

        // Create mapping of IDs here to IDs there
        let idmapping = rids.map(({id, rid}) => ({[id]: rid}))
            .reduce((a, b) => Object.assign(a, b));
        idmapping[id] = url;
        let docs = Promise.map(rids, async ({id, rid}) => {
            let change = await lchanges[id];
            if (!change) {
                return Promise.resolve();
            }

            let type = change['_meta']['_type'];

            // Fix links etc.
            let body = JSON.stringify(change, function(k, v) {
                switch (k) {
                case '_meta': // Don't send resources's _meta
                    if (this === change) {
                        return undefined;
                    } else {
                        return v;
                    }
                case '_rev': // Don't resource's send _rev
                    if (this === change) {
                        return undefined;
                    } else {
                        return v;
                    }
                case '_id':
                    if (this === change) { // Don't send resource's _id
                        return undefined;
                    }
                    // TODO: Better link detection?
                    if (idmapping[v]) {
                        return idmapping[v];
                    }
                    warn(`Could not resolve link to ${v} at ${domain}`);
                    // TODO: What to do in this case?
                    return '';
                default:
                    return v;
                }
            });
            // TODO: Support DELETE
            return axios({
                method: 'put',
                url: `${await apiroot}${rid}`,
                data: body,
                headers: {
                    'content-type': type,
                    authorization: token
                }
            });
        });

        return docs;
    });

    await puts;
});
