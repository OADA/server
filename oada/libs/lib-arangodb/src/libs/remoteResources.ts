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

import { config } from '../config.js';
import { db as database } from '../db.js';

import { aql } from 'arangojs';
import debug from 'debug';

const trace = debug('arangodb#remoteResources:trace');

const remoteResources = database.collection(
  config.get('arangodb.collections.remoteResources.name')
);

export interface RemoteID {
  /**
   * The id of the resource here
   */
  id: string;
  /**
   * The id of the resource there (the remote)
   */
  rid: string;
}

export async function getRemoteId(
  id: string | readonly string[],
  domain: string
): Promise<AsyncIterable<RemoteID>> {
  const ids = Array.isArray(id) ? id : [id];

  trace('Looking up remote IDs for %s at %s', ids, domain);
  const rids = await database.query(
    aql`
        FOR id IN ${ids}
          LET rid = FIRST(
            FOR rRes IN ${remoteResources}
              FILTER rRes.resource_id == id
              FILTER rRes.domain == ${domain}
              RETURN rRes.remote_id
          )
          RETURN {
            rid: rid,
            id: id
          }`
  );

  trace(rids, 'Found');
  return rids;
}

export async function addRemoteId(
  rid: RemoteID | RemoteID[],
  domain: string
): Promise<void> {
  const rids = Array.isArray(rid) ? rid : [rid];

  trace('Adding remote IDs: %O', rids);
  await database.query(aql`
    FOR rid IN ${rids}
      INSERT {
        domain: ${domain},
        resource_id: rid.id,
        remote_id: rid.rid
      } INTO ${remoteResources}`);
}

// FIXME: Better way to handler errors?
// ErrorNum from: https://docs.arangodb.com/2.8/ErrorCodes/
// eslint-disable-next-line @typescript-eslint/naming-convention
export const NotFoundError = {
  name: 'ArangoError',
  errorNum: 1202,
};
// eslint-disable-next-line @typescript-eslint/naming-convention
export const UniqueConstraintError = {
  name: 'ArangoError',
  errorNum: 1210,
};
