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
const info = debug('webhooks:info');
const error = debug('webhooks:error');
var Promise = require('bluebird');
const uuid = require('uuid');

const {Responder, Requester} = require('../../libs/oada-lib-kafka');
const {users} = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const contentTypes = {
    bookmarks: 'application/vnd.oada.bookmarks.1+json',
    shares: 'application/vnd.oada.shares.1+json'
};

const responder = new Responder(
        config.get('kafka:topics:userRequest'),
        config.get('kafka:topics:httpResponse'),
        'users');
const requester = new Requester(
        config.get('kafka:topics:httpResponse'),
        config.get('kafka:topics:writeRequest'),
        'users');

module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', function handleReq(req) {
    // TODO: Sanitize?
    let user = req.user;

    return users.create(user, true)
        .then(function ensureUserResources(user) {
            // Create empty resources for user
            ['bookmarks', 'shares'].forEach(function ensureResource(res) {
                if (!(user[res] && user[res]._id)) {
                    let resid = 'resources/' + uuid();

                    trace(`Creating ${resid} for ${res} of ${user.id}`);
                    user[res] =
                        requester.send({
                            'url': '/' + resid,
                            'resource_id': '',
                            'path_leftover': '/' + resid,
                            'meta_id': resid + '/_meta',
                            'user_id': user._id,
                            // TODO: What to put for these?
                            //'authorizationid': ,
                            //'client_id': ,
                            'contentType': contentTypes[res],
                            'body': {}
                        }).tap(resp => {
                            if (resp.code !== 'success') {
                                // TODO: Clean up on failure?
                                error(resp.code);
                                let err = new Error(`Failed to create ${res}`);
                                return Promise.reject(err);
                            }
                        }).return({_id: resid});
                }
            });

            return user;
        })
        .props()
        .then(users.update)
        .tap(user => info(`Created user ${user._id}`))
        .then(user => {
            return {
                code: 'success',
                new: true,
                user,
            };
        })
		.catch(users.UniqueConstraintError, () => {
            info(`User ${user} already exists`);
            // TODO: Implement updating users?
            return users.like(user).call('next').then(user => {
                return {
                    code: 'success',
                    new: false,
                    user
                };
            });
        })
        .catch(err => {
            error(err);
            return {code: err.message || 'error'}
        });
});
