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

import { URL } from 'url';

import { remoteResources, resources } from '@oada/lib-arangodb';
import { KafkaBase, Responder } from '@oada/lib-kafka';

import type { WriteResponse } from '@oada/write-handler';

import config from './config.js';

import axios from 'axios';
import Bluebird from 'bluebird';
import debug from 'debug';

const info = debug('sync-handler:info');
const trace = debug('sync-handler:trace');
const warn = debug('sync-handler:warn');
const error = debug('sync-handler:error');

// TODO: Where to store the syncs?
// I feel like putting webhooks in _syncs was a poor choice
const META_KEY = '_remote_syncs';

//---------------------------------------------------------
// Kafka initializations:
const responder = new Responder({
  consumeTopic: config.get('kafka.topics.httpResponse'),
  group: 'sync-handlers',
});

export function stopResp(): Promise<void> {
  return responder.disconnect();
}

/**
 * Filter for successful write responses
 */
function checkReq(req: KafkaBase): req is WriteResponse {
  return req?.msgtype === 'write-response' && req?.code === 'success';
}

responder.on<WriteResponse>('request', async function handleReq(req) {
  if (!checkReq(req)) {
    return;
  }

  const id = req['resource_id'];
  trace('Saw change for resource %s', id);

  //let rev = req['_rev'];
  const oRev = req['_orev'] ?? 0;
  // TODO: Add AQL query for just syncs and newest change?
  const syncs = Object.entries(
    ((await resources.getResource(id, `/_meta/${META_KEY}`)).syncs ??
      {}) as Record<string, { url: string; domain: string; token: string }>
  )
    // Ignore sync entries that aren't objects
    .filter((sync) => sync[1] && typeof sync[1] === 'object');

  if (syncs.length === 0) {
    // Nothing for us to do
    return;
  }
  trace('Processing syncs for resource %s', id);

  const desc = await resources.getNewDescendants(id, oRev);
  trace('New descendants for %s: %O', id, desc);
  // TODO: Figure out just what changed
  const changes = desc
    .filter((d) => d.changed)
    .map(({ id }) => ({ [id]: resources.getResource(id) }))
    .reduce((a, b) => Object.assign(a, b));

  // TODO: Probably should not be keeping the tokens under _meta...
  const puts = Bluebird.map(syncs, async ([key, { url, domain, token }]) => {
    info('Running sync %s for resource %s', key, id);
    trace('Sync %s: %O', key, { url, domain, token });
    // Need separate changes map for each sync since they run concurrently
    const lChanges = Object.assign({}, changes); // Shallow copy

    if (process.env.NODE_ENV !== 'production') {
      /*
       * If running in dev environment,
       * localhost should be directed to the proxy server
       */
      // eslint-disable-next-line no-param-reassign
      domain = domain.replace('localhost', 'proxy');
    }

    // TODO: Cache this?
    const apiroot = Bluebird.resolve(
      axios.get<{ oada_base_uri: string }>(
        `https://${domain}/.well-known/oada-configuration`
      )
    )
      .get('data')
      .get('oada_base_uri')
      .then((s) => s.replace(/\/?$/, '/'));

    // Ensure each local resource has a corresponding remote one
    const ids = desc.map((d) => d.id);
    let rids = (await remoteResources.getRemoteId(ids, domain))
      // Map the top resource to supplied URL
      .map((rid) => (rid.id === id ? { id, rid: url } : rid));
    // Create missing rids
    const newrids = await Bluebird.map(
      rids.filter(({ rid }) => !rid),
      async ({ id }) => {
        trace('Creating remote ID for %s at %s', id, domain);

        const url = `${await apiroot}resources/`;
        // Create any missing remote IDs
        const {
          headers: { location: loc },
        } = await axios.post<void, { headers: { location: string } }>(
          url,
          {},
          {
            headers: {
              authorization: token,
            },
          }
        );

        // TODO: Less gross way of create new remote resources?
        lChanges[id] = resources.getResource(id);

        // Parse resource ID from Location header
        const newID = new URL(loc, url).toString().replace(url, 'resources/');
        return {
          rid: newID,
          id: id,
        };
      }
    );
    // Add all remote IDs at once
    if (newrids.length === 0) {
      return;
    }

    // Record new remote ID
    await Bluebird.resolve(
      remoteResources.addRemoteId(newrids, domain)
    ).tapCatch(remoteResources.UniqueConstraintError, () => {
      error('Unique constraint error for remoteId %O %O', newrids, domain);
    });

    trace('Created remote ID for %s at %s: %O', id, domain, newrids);

    rids = rids.filter(({ rid }) => rid).concat(newrids);
    // Create mapping of IDs here to IDs there
    const idMapping = rids
      .map(({ id, rid }) => ({ [id]: rid }))
      .reduce((a, b) => ({ ...a, ...b }), {});
    const docs = Bluebird.map(rids, async ({ id, rid }) => {
      const change = await lChanges[id];
      if (!change) {
        return Promise.resolve();
      }

      trace('PUTing change for %s to %s at %s', id, rid, domain);

      const type = change['_meta']?.['_type'];

      // Fix links etc.
      const body = JSON.stringify(change, function (k, v: unknown) {
        /* eslint-disable no-invalid-this */
        switch (k) {
          case '_meta': // Don't send resources's _meta
            if (this === change) {
              return undefined;
            } else {
              return v;
            }
          case '_rev': // Don't send resource's _rev
            if (this === change) {
              return undefined;
            } else {
              return v;
            }
          case '_id':
            if (this === change) {
              // Don't send resource's _id
              return undefined;
            }
            // TODO: Better link detection?
            if (idMapping[v as string]) {
              return idMapping[v as string];
            }
            warn('Could not resolve link to %s at %s', v, domain);
            // TODO: What to do in this case?
            return '';
          default:
            return v;
        }
        /* eslint-enable no-invalid-this */
      });

      // TODO: Support DELETE
      const put = axios({
        method: 'put',
        url: `${await apiroot}${rid}`,
        data: body,
        headers: {
          'content-type': type!,
          'authorization': token,
        },
      });
      await put;

      trace(
        'Finished PUTing change for %s to %s at %s: %O',
        id,
        rid,
        domain,
        await put
      );
      return put;
    });

    return docs;
  });

  await puts;
});
