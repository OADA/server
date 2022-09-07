/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config } from './config.js';

import '@oada/lib-prom';

import { changes, resources } from '@oada/lib-arangodb';
import type { KafkaBase } from '@oada/lib-kafka';
import { Responder } from '@oada/lib-kafka';

import type Resource from '@oada/types/oada/resource.js';
import type { WriteResponse } from '@oada/write-handler';

import Bluebird from 'bluebird';
import { default as axios } from 'axios';
import debug from 'debug';

const trace = debug('webhooks:trace');
const error = debug('webhooks:error');

// ---------------------------------------------------------
// Kafka initializations:
const responder = new Responder({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  group: 'webhooks',
});

export async function stopResp(): Promise<void> {
  return responder.disconnect();
}

/**
 * Check for successful write request
 */
function checkRequest(request: KafkaBase): request is WriteResponse {
  return request?.msgtype === 'write-response' && request?.code === 'success';
}

export interface Sync {
  'url': string;
  'headers': Record<string, string>;
  'oada-put': boolean;
}
type Syncs = Record<string, Sync>;

responder.on<void>('request', async (request) => {
  if (!checkRequest(request)) {
    return;
  }

  // TODO: Add AQL query for just syncs and newest change?
  const meta = (await resources.getResource(request.resource_id, '/_meta')) as {
    _syncs?: Syncs;
    _changes: Record<number, { _id: string }>;
  };
  if (meta?._syncs) {
    return Bluebird.map(Object.values(meta._syncs), async (sync) => {
      if (process.env.NODE_ENV !== 'production') {
        /*
         * If running in dev environment,
         * https://localhost webhooks should be directed to the proxy server.
         */
        sync.url = sync.url.replace('localhost', 'proxy');
      }

      if (sync['oada-put']) {
        const change = await changes.getChange(
          request.resource_id,
          request._rev
        );
        if (!change) {
          error(
            'Failed to get change %d for %s',
            request._rev,
            request.resource_id
          );
          return;
        }

        const { _meta, _rev, _id, _type, ...body } = (change.body ??
          {}) as Partial<Resource>;
        // If change is only to _id, _rev, _meta, or _type, don't do put
        if (Object.keys(body).length === 0) {
          return;
        }

        if (change.type === 'delete') {
          // Handle delete _changes
          const deletePath = [];
          let toDelete: unknown = body;
          trace('Sending oada-put to: %s', sync.url);
          while (
            toDelete &&
            typeof toDelete === 'object' &&
            Object.keys(toDelete).length > 0
          ) {
            const key = Object.keys(toDelete)[0];
            deletePath.push(key);
            toDelete = toDelete[key as keyof typeof toDelete];
          }

          if (toDelete !== null) {
            return;
          }

          const deleteUrl = `${sync.url}/${deletePath.join('/')}`;
          trace('Deleting: oada-put url changed to: %s', deleteUrl);
          await axios({
            method: 'delete',
            url: deleteUrl,
            headers: sync.headers,
          });
          return;
        }

        // Handle merge _changes
        trace('Sending oada-put to: %s', sync.url);
        trace(body, 'oada-put body');
        await axios({
          method: 'put',
          url: sync.url,
          data: body as unknown,
          headers: sync.headers,
        });
        return;
      }

      trace('Sending to: %s', sync.url);
      await axios(sync);
    });
  }
});
