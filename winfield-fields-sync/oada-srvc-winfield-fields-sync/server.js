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
const warn = debug('winfield-fields-sync:trace');
const trace = debug('winfield-fields-sync:trace');
const info = debug('winfield-fields-sync:info');
const error = debug('winfield-fields-sync:error');
const uuid = require('uuid')

const Promise = require('bluebird');
const _ = require('lodash')
const {ResponderRequester} = require('../../libs/oada-lib-kafka');
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios')
const awsSign = require('aws-v4-sign-small').sign;
const datasilo = require('./datasilo');

//---------------------------------------------------------
// Kafka intializations:
const responderRequester = new ResponderRequester({
  requestTopics: {
    consumeTopic: config.get('kafka:topics:httpResponse'),
    produceTopic: config.get('kafka:topics:writeRequest'),
  },
  respondTopics: {
    consumeTopic: config.get('kafka:topics:httpResponse'),
  },
  group: 'winfield-fields-sync'
});

module.exports = function stopResp() {
  return responderRequester.disconnect(); 
};

responderRequester.on('request', function handleReq(req) {
  trace('write-response?', req.msgtype === 'write-response', 'success?', req.code ==='success')
  if (req.msgtype !== 'write-response') return
  if (req.code !== 'success') return
  trace('request: ', req)
  return oadaLib.resources.getResource(req.resource_id).then((res) => {
    if (res._type !== 'application/vnd.trellisfw.certifications.1+json') return
    trace('res', res)
    let writes = []
    let owner = findNewCertifications(res, res._meta._owner).then((write) => {
      return writes.push(...write)
    })
    // Check other permissioned users for any writes and reindexes needed
    trace('res._meta._permissions', res._meta._permissions)
    let other_users = Promise.map(Object.keys(res._meta._permissions || {}), (id) => {
      // If this user hasn't been indexed before, all certifications are "new", else use only recent _changes
      return findNewCertifications(res, id).then((write) => {
        return writes.push(...write)
      })
    })
   // Combine all of the resolved write requests into a single array to return
    return Promise.join(owner, other_users, ()=> {})
    .then((result) => {
      trace('WRITES', writes)
      return Promise.map(writes, (write) => {
        return responderRequester.send(write)
          .catch(Promise.TimeoutError, (err) => {
            trace(err, write)
          })
      }).return(undefined)
    })
  })
})

responderRequester.on('request', function handleReq(req) {
  trace('write-response?', req.msgtype === 'write-response', 'success?', req.code ==='success')
  if (req.msgtype !== 'write-response') return
  if (req.code !== 'success') return
  trace('request: ', req)
  return oadaLib.resources.getResource(req.resource_id).then((res) => {
    if (res._type !== 'application/vnd.trellisfw.certifications.1+json') return
    trace('res', res)
    let writes = []
    let owner = findNewCertifications(res, res._meta._owner).then((write) => {
      return writes.push(...write)
    })
    // Check other permissioned users for any writes and reindexes needed
    trace('res._meta._permissions', res._meta._permissions)
    let other_users = Promise.map(Object.keys(res._meta._permissions || {}), (id) => {
      // If this user hasn't been indexed before, all certifications are "new", else use only recent _changes
      return findNewCertifications(res, id).then((write) => {
        return writes.push(...write)
      })
    })
   // Combine all of the resolved write requests into a single array to return
    return Promise.join(owner, other_users, ()=> {})
    .then((result) => {
      trace('WRITES', writes)
      return Promise.map(writes, (write) => {
        return responderRequester.send(write)
          .catch(Promise.TimeoutError, (err) => {
            trace(err, write)
          })
      }).return(undefined)
    })
  })
})
