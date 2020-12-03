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
const trace = debug('shares:trace');
const info = debug('shares:info');
const error = debug('shares:error');

const Promise = require('bluebird');
const Responder = require('oada-lib-kafka').Responder;
const oadaLib = require('oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
  config.get('kafka:topics:httpResponse'),
  config.get('kafka:topics:writeRequest'),
  'shares'
);

module.exports = function stopResp() {
  return responder.disconnect();
};

responder.on('request', function handleReq(req) {
  if (req.msgtype !== 'write-response') return;
  if (req.code !== 'success') return;
  //TODO: CHECK FOR OTHER ITERATIONS OF _meta/_permissions as it might occur in a request
  if (
    /_meta\/?$/.test(req.path_leftover) ||
    /_meta\/_permissions\/?/.test(req.path_leftover)
  ) {
    //get user's /shares and add this
    return oadaLib.changes
      .getChange(req.resource_id, req._rev)
      .then((change) => {
        if (change.type === 'merge' && change.body._meta) {
          return Promise.map(
            Object.keys(change.body._meta._permissions || {}),
            (id) => {
              trace('Change made on user: ' + id);
              return oadaLib.users.findById(id).then((user) => {
                trace(
                  'making a write request to /shares for user - ' + id,
                  user
                );
                return {
                  resource_id: user.shares._id,
                  path_leftover: '',
                  //						'meta_id': req['meta_id'],
                  user_id: user._id,
                  //					 'authorizationid': req.user.doc['authorizationid'],
                  //			     'client_id': req.user.doc['client_id'],
                  contentType: 'application/vnd.oada.permission.1+json',
                  body: {
                    [req.resource_id.replace(/^resources\//, '')]: {
                      _id: req.resource_id,
                    },
                  },
                };
              });
            }
          );
        } else return;
      });
  } else return;
});
