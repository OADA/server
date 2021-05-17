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
import pointer from 'json-pointer';
import debug from 'debug';

import type Change from '@oada/types/oada/change/v2';

import { db } from '../db';

import config from '../config';

const trace = debug('arangodb#resources:trace');

const changes = db.collection(config.get('arangodb.collections.changes.name'));
const changeEdges = db.collection(
  config.get('arangodb.collections.changeEdges.name')
);

const MAX_DEPTH = 100;

/**
 * The type for the edges of the OADA change graph
 */
export interface ChangeEdge {
  path: string;
  _to: string;
  _from: string;
  _id: string;
  _key: string;
}
/**
 * The type for the vertices of the OADA change graph
 */
export type ChangeVertex = Change[0] & {
  number: number;
  hash: string;
  userid: string;
  authorizationid: string;
};

export async function getChanges(resourceId: string, _changeRev?: number) {
  const result = (await (
    await db.query(
      aql`
        FOR change in ${changes}
          FILTER change.resource_id == ${resourceId}
          RETURN change.number`
    )
  ).all()) as number[];

  // idk what this is about but it was here before...
  return result || undefined;
}

export async function getMaxChangeRev(resourceId: string) {
  const result = (await (
    await db.query(
      aql`
        RETURN FIRST(
          FOR change in ${changes}
            FILTER change.resource_id == ${resourceId}
            SORT change.number DESC
            LIMIT 1
            RETURN change.number
        )`
    )
  ).next()) as number;

  return result || 0;
}

/**
 * Produces a bare tree has a top level key at resourceId and traces down to the
 * actual change that induced this rev update
 *
 * @TODO using .body allows the changes to be nested, but doesn't allow us to
 * specify all of the other change details along the way down.
 */
export async function getChange(
  resourceId: string,
  changeRev: string | number
) {
  //TODO: This is meant to handle when resources are deleted directly. Edge
  // cases remain to be tested. Does this suffice regarding the need send down a
  // bare tree?
  if (!changeRev) {
    return {
      body: null,
      type: 'delete',
    };
  }

  const result = await (
    await db.query(
      aql`
        LET change = FIRST(
          FOR change in ${changes}
          FILTER change.resource_id == ${resourceId}
          FILTER change.number == ${parseInt(changeRev as string, 10)}
          RETURN change
        )
        LET path = LAST(
          FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change ${changeEdges}
          RETURN p
        )
        RETURN path`
    )
  ).next();

  if (!result || !result.vertices[0]) {
    return undefined;
  }
  const change = {
    body: result.vertices[0].body,
    type: result.vertices[0].type,
    wasDelete: result.vertices[result.vertices.length - 1].type === 'delete',
  };
  let path = '';
  for (let i = 0; i < result.vertices.length - 1; i++) {
    path += result.edges[i].path;
    pointer.set(change.body, path, result.vertices[i + 1].body);
  }
  return change;
}

/**
 * Produces a list of changes as an array
 */
export async function getChangeArray(
  resourceId: string,
  changeRev: string | number
): Promise<Change> {
  //TODO: This is meant to handle when resources are deleted directly. Edge
  // cases remain to be tested. Does this suffice regarding the need send down a
  // bare tree?
  if (!changeRev) {
    return [
      {
        resource_id: resourceId,
        path: '',
        // @ts-ignore
        body: null,
        type: 'delete',
      },
    ];
  }

  return db
    .query(
      aql`
        LET change = FIRST(
          FOR change in ${changes}
          FILTER change.resource_id == ${resourceId}
          FILTER change.number == ${parseInt(changeRev as string, 10)}
          RETURN change
        )
        FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change ${changeEdges}
          SORT LENGTH(p.edges), v.number
          RETURN p`
    )
    .then(async (cursor) => {
      // iterate over the graph
      return cursor.map((doc) => toChangeObj(doc)); // convert to change object
    });
}

function toChangeObj(arangoPathObj: {
  edges: ChangeEdge[];
  vertices: ChangeVertex[];
}): Change[0] {
  // get path
  let path = '';
  for (let j = 0; j < arangoPathObj.edges.length; j++) {
    path += arangoPathObj.edges[j]!.path;
  }
  // get body
  const nVertices = arangoPathObj.vertices.length;
  const body = arangoPathObj.vertices[nVertices - 1]!.body;
  const resource_id = arangoPathObj.vertices[nVertices - 1]!.resource_id;
  // return change object
  trace('toChangeObj: returning change object with body %O', body);
  return {
    resource_id,
    path,
    body,
    type: arangoPathObj.vertices[nVertices - 1]!.type,
  };
}

export async function getRootChange(
  resourceId: string,
  changeRev: string | number
) {
  return (await (
    await db.query(
      aql`
        LET change = FIRST(
          FOR change in ${changes}
          FILTER change.resource_id == ${resourceId}
          FILTER change.number == ${parseInt(changeRev as string, 10)}
          RETURN change
        )
        LET path = LAST(
          FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change ${changeEdges}
          RETURN v
        )
        RETURN path`
    )
  ).next()) as { edges: ChangeEdge[]; vertices: ChangeVertex[] };
}

export async function putChange({
  change,
  resId,
  rev,
  type,
  children,
  path,
  userId,
  authorizationId,
}: {
  change: Change[0]['body'];
  resId: Change[0]['resource_id'];
  rev: number | string;
  type: Change[0]['type'];
  children: string[];
  path?: Change[0]['path'];
  userId?: string;
  authorizationId?: string;
}): Promise<string> {
  if (!Array.isArray(children)) {
    throw new Error('children must be an array.');
  }

  const number = parseInt(rev as string, 10);
  trace('putChange: inserting change with body %O', change);
  return (await (
    await db.query(
      aql`
        LET doc = FIRST(
          INSERT {
            body: ${change},
            type: ${type},
            resource_id: ${resId},
            number: ${number},
            authorization_id: ${authorizationId || null},
            user_id: ${userId || null}
          } IN ${changes}
          RETURN NEW
        )

        LET children = (
          FOR child IN ${children}
            INSERT {
              _to: child,
              _from: doc._id,
              path: ${path || null}
            } in ${changeEdges}
        )
        RETURN doc._id`
    )
  ).next()) as string;
}
