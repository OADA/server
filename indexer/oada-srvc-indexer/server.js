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
const warn = debug('indexer:trace');
const trace = debug('indexer:trace');
const info = debug('indexer:info');
const error = debug('indexer:error');
const uuid = require('uuid')

const Promise = require('bluebird');
const _ = require('lodash')
const {ResponderRequester} = require('../../libs/oada-lib-kafka');
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios')

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
  group: 'indexer'
});

module.exports = function stopResp() {
  return responderRequester.disconnect(); 
};



function initializeIndexer(res, userid) {
  return {
    'resource_id': res._id,
    'path_leftover': `/_meta/trellis/client-to-certifications/`,
    'user_id': userid,
    'contentType': res._type,
    'body': {
      [userid]: {isInitialized: true}
    }
  }
}

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

function findNewCertifications(certsResource, id) {
  // Check owner for any necessary writes and reindexes  
  let writes = [];
  let newCerts = certsResource;
  if (certsResource._meta.trellis && certsResource._meta.trellis['client-to-certifications'][id]) {
//    newCerts = certsResource._meta._changes[certsResource._rev].merge;
  } else {
//    newCerts = certsResource
    writes.push(initializeIndexer(certsResource, id))
  }

  trace('re-indexing for user: ', id)
  return oadaLib.users.findById(id).then((user) => {
    // Define all of the resources and links that MAY be necessary.
    // They may be trimmed down below.
    let certifications = {
      'resource_id': '',
      'path_leftover': '/resources/'+uuid.v4(),
      'user_id': user._id,
      'contentType': 'application/vnd.trellisfw.certifications.1+json',
    }
    certifications.body = {
      _type: 'application/vnd.trellisfw.certifications.1+json',
      _id: certifications.path_leftover.replace(/^\//, ''),
      _rev: '0-0',
    }
    Object.keys(newCerts).forEach((key) => {
      if (key.charAt(0) !== '_') {
        certifications.body[key] = { 
          _id: newCerts[key]._id,
          _rev: newCerts[key]._rev
        }
      }
    })
    let trellisfw = {
      'resource_id': '',
      'path_leftover': '/resources/'+uuid.v4(),
      'user_id': user._id,
      'contentType': 'application/vnd.trellisfw.1+json',
      'indexer': true,
    }
    trellisfw.body = {
      _type: 'application/vnd.trellisfw.1+json',
      _id: trellisfw.path_leftover.replace(/^\//, ''),
      _rev: '0-0',
      certifications: {
        _id: certifications.body._id,
        _rev: certifications.body._rev 
      }
    }
    let bookmarks = {
      'resource_id': user.bookmarks._id,
      'path_leftover': '',
      'user_id': user._id,
      'contentType': 'application/vnd.oada.bookmarks.1+json',
      'indexer': true,
    }
    bookmarks.body = {
      trellisfw: {
        _id: trellisfw.body._id,
        _rev: trellisfw.body._rev
      }
    }
    trace('trellisfw RESOURCE', trellisfw)
    trace('CERTIFICATIONS RESOURCE', certifications)
    trace('BOOKMARKS RESOURCE', bookmarks)
    return oadaLib.resources.lookupFromUrl('/'+user.bookmarks._id+'/trellisfw/certifications', user._id).then((result) => {
      trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
      trace('lookupUrl result: ', result)
      if (result.path_leftover === '') { // trellisfw and certifications exist
        certifications.path_leftover = ''
        certifications.resource_id = result.resource_id
        certifications.contentType = 'application/vnd.trellisfw.certifications.1+json';
        delete certifications.body._id
        delete certifications.body._rev
        trace('GETreSource', result.resource_id)
        return oadaLib.resources.getResource(result.resource_id).then((curCerts) => {
          if (curCerts._type === 'application/vnd.trellisfw.certifications.1+json') {
            delete certifications.body._type
          } else {
            certifications.body._type = 'application/vnd.trellisfw.certifications.1+json'
          }
          trace('Current CERTS', curCerts)
          trace('New CERTS', newCerts)
          // Prune off the certifications that have already been re-indexed
          Object.keys(newCerts).forEach((key) => {
            if (key.charAt(0) !== '_') {
              if (curCerts[key]) {
                delete certifications.body[key];
                trace('cert already exists', certifications.body[key])
              }
            }
          })
          trace('1', certifications.body)
          if (_.isEmpty(certifications.body)) return []
          writes.push(certifications)
          return writes
        })
      } else if (/\/trellisfw/.test(result.path_leftover)) {
      // neither trellisfw nor certifications exist
        trace('2', [certifications, trellisfw, bookmarks])
        writes.push(trellisfw, bookmarks, certifications)
        return writes
      } else {
      // trellisfw exists, certifications doesn't exist
        delete trellisfw.body._id
        delete trellisfw.body._rev
        delete trellisfw.body._type
        trellisfw.resource_id = result.resource_id
        trellisfw.path_leftover= '' 
        trace('3', [certifications, trellisfw])
        writes.push(trellisfw, certifications)
        return writes
      }
    })
  })
}
