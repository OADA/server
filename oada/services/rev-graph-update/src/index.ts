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
import Ajv, { JTDSchemaType } from 'ajv/dist/jtd';
import type { SetRequired } from 'type-fest';

import { Responder, Requester, KafkaBase } from '@oada/lib-kafka';
import { resources } from '@oada/lib-arangodb';

// Import message format from write-handler
import type { WriteResponse, WriteRequest } from '@oada/write-handler';

import config from './config';

const trace = debug('rev-graph-update:trace');
const info = debug('rev-graph-update:info');
const warn = debug('rev-graph-update:warn');
const error = debug('rev-graph-update:error');

//---------------------------------------------------------
// Batching
// adjust concurrency as needed
const requestPromises = new PQueue({ concurrency: 1 });
// This map is used as a queue of pending write requests
const requests = new Map<string, SetRequired<WriteRequest, 'from_change_id'>>();

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  group: 'rev-graph-update',
});
const requester = new Requester({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  produceTopic: config.get('kafka.topics.writeRequest'),
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

// Create custom parser and serializer for causechain.
// Should be faster than JSON methods and is slightly nicer in TypeScript.
const ajv = new Ajv();
const causechainSchema: JTDSchemaType<string[]> = {
  elements: { type: 'string' },
};
const parse = ajv.compileParser(causechainSchema);
const serialize = ajv.compileSerializer(causechainSchema);

responder.on<WriteRequest>('request', async function handleReq(req) {
  if (!checkReq(req)) {
    return; // not a successful write-response message, ignore it
  }
  if (!req.resource_id || !Number.isInteger(req._rev)) {
    throw new Error(
      'Invalid http_response: keys resource_id or _rev are missing: ' +
        JSON.stringify(req)
    );
  }

  if (typeof req['user_id'] === 'undefined') {
    warn('Received message does not have user_id');
  }
  if (typeof req.authorizationid === 'undefined') {
    warn('Received message does not have authorizationid');
  }

  // find resource's parent
  info('finding parents for resource_id = %s', req.resource_id);
  const parents = await resources.getParents(req.resource_id);
  if (!parents?.length) {
    trace('%s does not have parents.', req.resource_id);
    return;
  }
  trace('the parents are: %O', parents);

  if (parents.some((p) => p.resource_id === req.resource_id)) {
    throw new Error(`${req.resource_id} is its own parent!`);
  }

  // Real cycle detection: check the write-response's causechain
  // to see if the parent was already updated.
  // If so, no need to update it again, thus breaking the cycle.
  const causechain: string[] = [];
  if (req.causechain) {
    // in case req.causechain was an empty string
    const chain = parse(req.causechain);
    if (chain) {
      causechain.push(...chain);
    } else {
      error(
        'Error parsing req.causechain at %s: %s',
        parse.position,
        parse.message
      );
    }
  }
  // Add this resource to the set of "causing" resources to prevent cycles
  causechain.push(req.resource_id);

  for (const parent of parents) {
    // delete has null rev
    const childrev = typeof req._rev === 'number' ? req._rev : 0;

    // Do not update parent if it was already the cause of a rev update
    // on this chain (prevent cycles)
    if (causechain.includes(parent.resource_id)) {
      info(
        'Parent %s exists in causechain, not scheduling for update',
        parent.resource_id
      );
      continue;
    }

    const uniqueKey = parent.resource_id + parent.path + '/_rev';
    const qreq = requests.get(uniqueKey);
    if (qreq) {
      // Write request exists in the pending queue.
      // Add change ID to the request.
      info(
        'Resource %s already queued for changes, adding to queue',
        uniqueKey
      );
      if (req.change_id) {
        qreq.from_change_id.push(req.change_id);
      }
      qreq.body = req['_rev'];
    } else {
      info(
        'Writing new child link rev (%d) to %s%s/_rev',
        childrev,
        parent.resource_id,
        parent.path
      );
      // Create a new write request.
      const msg = {
        connection_id: null, // TODO: Fix ReResponder for multiple responses?
        type: 'write_request',
        resource_id: parent.resource_id,
        path: null,
        contentType: parent.contentType,
        body: childrev,
        url: '',
        user_id: 'system/rev_graph_update', // FIXME
        // This is an array; new change IDs may be added later
        from_change_id: req.change_id ? [req.change_id] : [],
        authorizationid: 'authorizations/rev_graph_update', // FIXME
        change_path: parent.path,
        path_leftover: parent.path + '/_rev',
        resourceExists: true,
        causechain: serialize(causechain),
      };

      // Add the request to the pending queue
      requests.set(uniqueKey, msg);
      // push
      requestPromises.add(async () => {
        const msgPending = requests.get(uniqueKey);
        requests.delete(uniqueKey);
        return msgPending && requester.send(msgPending);
      });
    }
  }
});
