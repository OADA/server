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
const _ = require('lodash');
const Responder = require('oada-lib-kafka').Responder;
const oadaLib = require('oada-lib-arangodb');
const config = require('./config');
const axios = process.env.SSL_ALLOW_SELF_SIGNED
  ? require('axios').create({
      httpsAgent: new require('https').Agent({ rejectUnauthorized: false }),
    })
  : require('axios');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
  config.get('kafka:topics:httpResponse'),
  null,
  'webhooks'
);

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
  return oadaLib.resources
    .getResource(req.resource_id, '/_meta')
    .then((meta) => {
      if (meta && meta._syncs) {
        return Promise.map(Object.keys(meta._syncs), (sync) => {
          var url = meta._syncs[sync].url;
          if (process.env.NODE_ENV !== 'production') {
            /*
                        If running in dev environment, https://localhost webhooks should
                        be directed to the proxy server
                      */
            url = url.replace('localhost', 'proxy');
          }
          if (meta._syncs[sync]['oada-put']) {
            let change = meta._changes[req._rev];
            let body = change.merge || {};
            if (change.delete) {
              //Handle delete _changes
              var deletePath = [];
              var toDelete = _.omit(change.delete, ['_meta', '_rev']);
              if (_.keys(toDelete).length == 0) return;
              trace('Sending oada-put to: ' + url);
              while (_.isObject(toDelete) && _.keys(toDelete).length > 0) {
                let key = _.keys(toDelete)[0];
                deletePath.push(key);
                toDelete = toDelete[key];
              }
              if (toDelete != null) return;
              let deleteUrl = url + '/' + deletePath.join('/');
              trace('Deleting: oada-put url changed to:', deleteUrl);
              return axios({
                method: 'delete',
                url: deleteUrl,
                headers: meta._syncs[sync].headers,
              });
            } else {
              //Handle merge _changes
              //If change is only to _id, _rev, _meta, or _type, don't do put
              if (
                _.keys(_.omit(body, ['_id', '_rev', '_meta', '_type']))
                  .length == 0
              )
                return;
              trace('Sending oada-put to: ' + url);
              trace('oada-put body: ', body);
              return axios({
                method: 'put',
                url: url,
                data: body,
                headers: meta._syncs[sync].headers,
              });
            }
          }
          trace('Sending to: ' + url);
          return axios(meta._syncs[sync]);
        });
      }
    })
    .then(() => {})
    .tapCatch(error);
});
