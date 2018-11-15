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
const trace = debug('token-lookup:trace');
const info = debug('token-lookup:info');
const error = debug('token-lookup:error');

// const kf = require('kafka-node');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');

process.on('exit', () => {
    info('process exit');
});

process.on('SIGINT', () => {
    info('SIGINT');
    process.exit(2);
});

process.on('uncaughtException', (a) => {
    info('uncaughtException: ', a);
    process.exit(99);
});

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
            config.get('kafka:topics:tokenRequest'),
            config.get('kafka:topics:httpResponse'),
            config.get('kafka:groupId'));

module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', function handleReq(req) {
        if (!req ||
            typeof req.resp_partition === "undefined" ||
            typeof req.connection_id === "undefined") {
            error('Invalid token_request for request: ' + JSON.stringify(req));
            return {};
        }

        const res = {
            type: 'http_response',
            token: req.token,
            token_exists: false,
            partition: req.resp_partition,
            connection_id: req.connection_id,
            doc: {
                authorizationid: null,
                user_id: null,
                scope: [],
                bookmarks_id: null,
                shares_id: null,
                client_id: null,
            }
        };

        if (typeof req.token === "undefined") {
            trace('No token supplied with the request.');
            return res;
        }
            // Get token from db.  Later on, we should speed this up
            // by getting everything in one query.
        return oadaLib.authorizations.findByToken(req.token.trim().replace(/^Bearer /, ''))
            .then(t => {
                    let msg = Object.assign({}, res);

                    if (!t) {
                        info('WARNING: token ' + req.token + ' does not exist.');
                        msg.token = null;
                        return msg;
                    }

                    if (!t._id) {
                        info('WARNING: _id for token does not exist in response');
                    }

                    if (!t.user) {
                        info(`user for token ${t.token} not found`);
                        t.user = {};
                    }

                    if (!t.user.bookmarks) {
                        info(`No bookmarks for user from token ${t.token}`);
                        t.user.bookmarks = {};
                    }

                    msg.token_exists = true;
                    trace('received authorization, _id = ', t._id);
                    msg.doc.authorizationid = t._id;
                    msg.doc.client_id = t.clientId;
                    msg.doc.user_id = t.user._id || msg.doc.user_id;
                    msg.doc.bookmarks_id = t.user.bookmarks._id || msg.doc.bookmarks_id;
                    msg.doc.shares_id = t.user.shares._id || msg.doc.shares_id;
										msg.doc.scope = t.scope || msg.doc.scope;

                    return msg;
            })
            .catch(err => {
                error(err);
                return res;
            });
});
