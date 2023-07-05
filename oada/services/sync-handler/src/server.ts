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

import '@oada/pino-debug';

import { config } from './config.js';

import '@oada/lib-prom';

import { URL } from 'node:url';
import { join } from 'node:path';

import { remoteResources, resources } from '@oada/lib-arangodb';
import type { KafkaBase } from '@oada/lib-kafka';
import type { Resource } from '@oada/lib-arangodb/dist/libs/resources.js';
import { Responder } from '@oada/lib-kafka';

import type { WriteResponse } from '@oada/write-handler';

import debug from 'debug';
import got from 'got';

const info = debug('sync-handler:info');
const trace = debug('sync-handler:trace');
const warn = debug('sync-handler:warn');

// TODO: Where to store the syncs?
// I feel like putting webhooks in _syncs was a poor choice
const META_KEY = '_remote_syncs';

// ---------------------------------------------------------
// Kafka initializations:
const responder = new Responder({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  group: 'sync-handlers',
});

export async function stopResp(): Promise<void> {
  return responder.disconnect();
}

/**
 * Filter for successful write responses
 */
function checkRequest(request: KafkaBase): request is WriteResponse {
  return request?.msgtype === 'write-response' && request?.code === 'success';
}

responder.on<WriteResponse>('request', async (request) => {
  if (!checkRequest(request)) {
    return;
  }

  const resourceId = request.resource_id;
  trace('Saw change for resource %s', resourceId);

  // Let rev = req['_rev'];
  const oRev = request._orev ?? 0;
  // TODO: Add AQL query for just syncs and newest change?
  const syncs = Object.entries(
    ((await resources.getResource(resourceId, `/_meta/${META_KEY}`))?.syncs ??
      {}) as Record<string, { url: string; domain: string; token: string }>,
  )
    // Ignore sync entries that aren't objects
    .filter((sync) => sync[1] && typeof sync[1] === 'object');

  if (syncs.length === 0) {
    // Nothing for us to do
    return;
  }

  trace('Processing syncs for resource %s', resourceId);

  const descendants = await resources.getNewDescendants(resourceId, oRev);
  const changes: Record<string, Promise<Resource | undefined>> = {};
  const ids: string[] = [];
  for await (const desc of descendants) {
    trace('New descendant for %s: %O', resourceId, desc);
    ids.push(desc.id);

    if (!desc.changed) {
      continue;
    }

    // TODO: Figure out just what changed
    changes[desc.id] = resources.getResource(desc.id);
  }

  // TODO: Probably should not be keeping the tokens under _meta...
  const puts = Promise.all(
    syncs.map(async ([key, { url, domain, token }]) => {
      info('Running sync %s for resource %s', key, resourceId);
      trace('Sync %s: %O', key, { url, domain, token });
      // Need separate changes map for each sync since they run concurrently
      const lChanges = new Map(Object.entries(changes));

      if (process.env.NODE_ENV !== 'production') {
        /**
         * If running in dev environment,
         * localhost should be directed to the proxy server
         */

        domain = domain.replace('localhost', 'proxy');
      }

      // TODO: Cache this?
      const { oada_base_uri: apiroot } = await got(
        `https://${domain}/.well-known/oada-configuration`,
      ).json<{ oada_base_uri: string }>();

      // Ensure each local resource has a corresponding remote one
      let rids: remoteResources.RemoteID[] = [];
      for await (const rid of await remoteResources.getRemoteId(ids, domain)) {
        rids.push(rid.id === resourceId ? { id: resourceId, rid: url } : rid);
      }

      // Create missing rids
      const newrids = await Promise.all(
        rids
          .filter(({ rid }) => !rid)
          .map(async ({ id }) => {
            trace('Creating remote ID for %s at %s', id, domain);

            const path = join(apiroot, 'resources');
            // Create any missing remote IDs
            const {
              headers: { location: loc },
            } = await got.post(path, {
              json: {},
              headers: {
                authorization: token,
              },
            });

            // TODO: Less gross way of create new remote resources?
            lChanges.set(id, resources.getResource(id));

            // Parse resource ID from Location header
            const newID = new URL(loc!, path)
              .toString()
              .replace(path, 'resources/');
            return {
              rid: newID,
              id,
            };
          }),
      );

      // Add all remote IDs at once
      if (newrids.length === 0) {
        return;
      }

      // Record new remote ID
      await remoteResources.addRemoteId(newrids, domain);

      trace('Created remote ID for %s at %s: %O', resourceId, domain, newrids);

      rids = rids.filter(({ rid }) => rid).concat(newrids);
      // Create mapping of IDs here to IDs there
      const idMapping = Object.fromEntries(
        rids.map(({ id, rid }) => [id, rid]),
      );
      return Promise.all(
        rids.map(async ({ id, rid }) => {
          const change = await lChanges.get(id);
          if (!change) {
            return;
          }

          trace('PUTing change for %s to %s at %s', id, rid, domain);

          const type = change._meta._type;

          // Fix links etc.
          const body = JSON.stringify(
            change,
            function (this: unknown, k, v: unknown) {
              switch (k) {
                case '_meta': // Don't send resources's _meta
                case '_rev': {
                  // Don't send resource's _rev
                  if (this === change) {
                    return;
                  }

                  return v;
                }

                case '_id': {
                  if (this === change) {
                    // Don't send resource's _id
                    return;
                  }

                  // TODO: Better link detection?
                  if (idMapping[v as string]) {
                    return idMapping[v as string];
                  }

                  warn('Could not resolve link to %s at %s', v, domain);
                  // TODO: What to do in this case?
                  return '';
                }

                default: {
                  return v;
                }
              }
            },
          );

          // TODO: Support DELETE
          const put = got({
            method: 'put',
            url: join(apiroot, rid),
            body,
            headers: {
              'content-type': `${type}`,
              'authorization': token,
            },
          });
          await put;

          trace(
            'Finished PUTing change for %s to %s at %s: %O',
            id,
            rid,
            domain,
            await put,
          );
          return put;
        }),
      );
    }),
  );

  await puts;
});
