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
import Bluebird from 'bluebird';

import { Responder, KafkaBase } from '@oada/lib-kafka';
import { changes, users } from '@oada/lib-arangodb';

import type { WriteResponse, WriteRequest } from '@oada/write-handler';

import config from './config';

const trace = debug('shares:trace');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  produceTopic: config.get('kafka.topics.writeRequest'),
  group: 'shares',
});

export function stopResp() {
  return responder.disconnect();
}

/**
 * Filter for successful write responses
 */
function checkReq(req: KafkaBase): req is WriteResponse {
  return req?.msgtype === 'write-response' && req?.code === 'success';
}

responder.on<WriteRequest>('request', async function handleReq(req) {
  if (!checkReq(req)) {
    return;
  }
  //TODO: CHECK FOR OTHER ITERATIONS OF _meta/_permissions as it might occur in a request
  if (
    /_meta\/?$/.test(req.path_leftover) ||
    /_meta\/_permissions\/?/.test(req.path_leftover)
  ) {
    //get user's /shares and add this
    const change = await changes.getChange(req.resource_id, req._rev);
    if (change?.type === 'merge' && change?.body._meta) {
      return await Bluebird.map(
        Object.keys(change.body._meta._permissions || {}),
        async (id) => {
          trace('Change made on user: %s', id);
          const user = await users.findById(id);
          trace('making a write request to /shares for user - %s %s', id, user);
          return {
            resource_id: user!.shares._id,
            path_leftover: '',
            //						'meta_id': req['meta_id'],
            user_id: user?._id,
            //					 'authorizationid': req.user.doc['authorizationid'],
            //			     'client_id': req.user.doc['client_id'],
            contentType: 'application/vnd.oada.permission.1+json',
            body: {
              [req.resource_id.replace(/^resources\//, '')]: {
                _id: req.resource_id,
              },
            },
          };
        }
      ).filter((it) => it !== null);
    } else return;
  } else return;
});
