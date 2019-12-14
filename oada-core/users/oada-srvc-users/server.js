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
const warn = debug('webhooks:warn');
const error = debug('webhooks:error');
var Promise = require('bluebird');
const uuid = require('uuid');

const {ResponderRequester} = require('../../libs/oada-lib-kafka');
const {users} = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const contentTypes = {
    bookmarks: 'application/vnd.oada.bookmarks.1+json',
    shares: 'application/vnd.oada.shares.1+json'
};

const responder = new ResponderRequester({
    requestTopics: {
        produceTopic: config.get('kafka:topics:writeRequest'),
        consumeTopic: config.get('kafka:topics:httpResponse'),
    },
    respondTopics: {
        consumeTopic: config.get('kafka:topics:userRequest'),
        produceTopic: config.get('kafka:topics:httpResponse'),
    },
    group: 'user-handlers'
});


module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', function handleReq(req) {
    // TODO: Sanitize?
    let user = req.user;
    // While this could fit in permissions_handler, since users are not really resources (i.e. no graph),
    // we'll add a check here that the user has oada.admin.user:write or oada.admin.user:all scope
    const token = _.cloneDeep(req.token) || {};
    const tokenscope = _.isArray(token.scope) ? _.join(token.scope, ' ') : (token.scope || ''); // force to space-separated string
    if (!tokenscope.match(/oada.admin.user:write/) && !tokenscope.match(/oada.admin.user:all/)) {
      warn('WARNING: attempt to create a user, but request does not have token with oada.admin.user:write or oada.admin.user:all scope');
      return { code: 'ERROR: token does not have required scope to create users.' };
    }
    const tokenuser = token.user || {};
    const userscope = _.isArray(tokenuser.scope) ? _.join(tokenuser.scope, ' ') : (tokenuser.scope || ''); // force to space-separated string
    if (!userscope.match(/oada.admin.user:write/) && !userscope.match(/oada.admin.user:all/)) {
      warn('WARNING: attempt to create a user, but user who owns token does not have scope to write users.');
      return { code: 'ERROR: user does not have required permission to create users.' };
    }

    return users.create(user, true)
        .then(function ensureUserResources(user) {
					// Create empty resources for user
            ['bookmarks', 'shares'].forEach(function ensureResource(res) {
                if (!(user[res] && user[res]['_id'])) {
                    let resid = 'resources/' + uuid();

                    console.log(`Creating ${resid} for ${res} of ${user._id} as _type = ${contentTypes[res]}`);
                    user[res] =
                        responder.send({
                            'url': '/' + resid,
                            'resource_id': '/' + resid,
                            'path_leftover': '',
                            'meta_id': resid + '/_meta',
                            'user_id': user['_id'],
                            // TODO: What to put for these?
                            //'authorizationid': ,
                            //'client_id': ,
                            'contentType': contentTypes[res],
                            'body': {}
                        }).tap(resp => {
                            if (resp.code === 'success') {
                                return Promise.resolve();
                            } else {
                                // TODO: Clean up on failure?
                                console.log(resp.code);
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
        .tap(user => console.log(`Created user ${user['_id']}`))
        .then(user => ({
            code: 'success',
            new: true,
            user,
        }))
        .catch(users.UniqueConstraintError, () => {
            console.log(`User ${JSON.stringify(user)} already exists`);
            // TODO: Implement updating users?
            return users.like(user).call('next').then(user => ({
                code: 'success',
                new: false,
                user
            }));
        })
        .catch(err => {
            console.log(err);
            return {code: err.message || 'error'};
        });
});
