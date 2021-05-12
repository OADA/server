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

import debug from 'debug';
import PQueue from 'p-queue';

import { ReResponder, Requester, KafkaBase } from '@oada/lib-kafka';
import * as oadaLib from '@oada/lib-arangodb';

// Import message format from write-handler
import type { WriteResponse, WriteRequest } from '@oada/write-handler';

import config from './config';

const trace = debug('rev-graph-update:trace');
const info = debug('rev-graph-update:info');
const warn = debug('rev-graph-update:warn');
//const error = debug('rev-graph-update:error');

//---------------------------------------------------------
// Batching
const requestPromises = new PQueue({ concurrency: 1 }); // adjust concurrency as needed
const requests = new Map(); // This map is used as a queue of pending write requests

//---------------------------------------------------------
// Kafka intializations:
const responder = new ReResponder({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  produceTopic: config.get('kafka.topics.writeRequest'),
  group: 'rev-graph-update',
});

const requester = new Requester({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  group: 'rev-graph-update-batch',
});

export function stopResp() {
  return responder.disconnect();
}

/**
 * check for successful write request
 */
function checkReq(req: KafkaBase): req is WriteResponse {
  return req?.msgtype === 'write-response' && req?.code === 'success';
}

responder.on<WriteRequest>('request', async function handleReq(req) {
  if (!checkReq(req)) {
    return []; // not a write-response message, ignore it
  }
  if (!req['resource_id'] || !Number.isInteger(req['_rev'])) {
    throw new Error(
      `Invalid http_response: keys resource_id or _rev are missing.  response = ${JSON.stringify(
        req
      )}`
    );
  }
  if (typeof req['user_id'] === 'undefined') {
    warn('Received message does not have user_id');
  }
  if (typeof req.authorizationid === 'undefined') {
    warn('Received message does not have authorizationid');
  }

  info(`finding parents for resource_id = ${req['resource_id']}`);

  // find resource's parent
  return oadaLib.resources.getParents(req['resource_id']).then((p) => {
    if (!p || p.length === 0) {
      warn(`${req['resource_id']} does not have a parent.`);
      return undefined;
    }

    trace('the parents are: %O', p);

    if (p.some((p) => p['resource_id'] === req['resource_id'])) {
      const err = new Error(`${req['resource_id']} is its own parent!`);
      return Promise.reject(err);
    }

    // Real cycle detection: check the write-response's causechain to see if the parent was already updated.  If so, no need to update it again, thus breaking the cycle.
    let causechain: string[] = [];
    if (req.causechain) {
      try {
        causechain = JSON.parse(req.causechain);
        if (!Array.isArray(causechain)) causechain = []; // in case req.causechain was an empty string
      } catch (e) {
        warn(
          'WARNING: failed to JSON.parse req.causechain.  It is: %s',
          req.causechain
        );
      }
    }
    causechain.push(req.resource_id); // Add this resource to the set of "causing" resources to prevent cycles

    p.forEach(function (item) {
      const childrev = typeof req._rev === 'number' ? req._rev : 0; // delete has null rev

      // Do not update parent if it was already the cause of a rev update on this chain (prevent cycles)
      if (causechain.includes(item.resource_id)) {
        info(
          'Parent ' +
            item.resource_id +
            ' exists in causechain, not scheduling for update'
        );
        return;
      }

      const uniqueKey = item['resource_id'] + item.path + '/_rev';
      if (requests.has(uniqueKey)) {
        // Write request exists in the pending queue. Add change ID to the request.
        info(
          'Resource ' +
            uniqueKey +
            ' already queued for changes, adding to queue'
        );
        if (req.change_id) {
          requests.get(uniqueKey).from_change_id.push(req.change_id);
        }
        requests.get(uniqueKey).body = req['_rev'];
      } else {
        info(
          'Writing new child link rev (' +
            childrev +
            ') to ' +
            item.resource_id +
            item.path +
            '/_rev'
        );
        // Create a new write request.
        const msg = {
          connection_id: null, // TODO: Fix ReResponder for multiple responses?
          type: 'write_request',
          resource_id: item['resource_id'],
          path: null,
          contentType: item.contentType,
          body: childrev,
          url: '',
          user_id: 'system/rev_graph_update', // FIXME
          from_change_id: req.change_id ? [req.change_id] : [], // This is an array; new change IDs may be added later
          authorizationid: 'authorizations/rev_graph_update', // FIXME
          change_path: item['path'],
          path_leftover: item.path + '/_rev',
          resourceExists: true,
          causechain: JSON.stringify(causechain),
        };

        // Add the request to the pending queue
        requests.set(uniqueKey, msg);

        // push
        requestPromises.add(() => {
          const msgPending = requests.get(uniqueKey);
          requests.delete(uniqueKey);
          return requester.send(
            msgPending,
            config.get('kafka.topics.writeRequest')
          );
        });
      }
    });

    return []; // FIXME
  });
});
