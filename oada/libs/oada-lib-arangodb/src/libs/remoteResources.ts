/* Copyright 2021 Open Ag Data Alliance
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

import { aql } from 'arangojs';
import debug from 'debug';

import { db } from '../db';

import config from '../config';

const trace = debug('arangodb#remoteResources:trace');

const remoteResources = db.collection(
  config.get('arangodb:collections:remoteResources:name')
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
  id: string | string[],
  domain: string
): Promise<RemoteID[]> {
  const ids = Array.isArray(id) ? id : [id];

  trace('Looking up remote IDs for %s at %s', ids, domain);
  const rids = (await (
    await db.query(
      aql`
        FOR id IN ${ids}
          LET rid = FIRST(
            FOR rres IN ${remoteResources}
              FILTER rres.resource_id == id
              FILTER rres.domain == ${domain}
              RETURN rres.remote_id
          )
          RETURN {
            rid: rid,
            id: id
          }`
    )
  ).all()) as RemoteID[];

  trace('Found: %O', rids);
  return rids;
}

export async function addRemoteId(
  rid: RemoteID | RemoteID[],
  domain: string
): Promise<void> {
  const rids = Array.isArray(rid) ? rid : [rid];

  trace('Adding remote IDs: %O', rids);
  await db.query(aql`
    FOR rid IN ${rids}
      INSERT {
        domain: ${domain},
        resource_id: rid.id,
        remote_id: rid.rid
      } INTO ${remoteResources}`);
}

// TODO: Better way to handler errors?
// ErrorNum from: https://docs.arangodb.com/2.8/ErrorCodes/
export const NotFoundError = {
  name: 'ArangoError',
  errorNum: 1202,
};
export const UniqueConstraintError = {
  name: 'ArangoError',
  errorNum: 1210,
};
