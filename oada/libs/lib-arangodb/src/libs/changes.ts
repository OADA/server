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

import {
  assert as assertChangeArray,
  type Change,
} from "@oada/types/oada/change/v2.js";
import { aql } from "arangojs";
import debug from "debug";
import { JsonPointer } from "json-ptr";

import { config } from "../config.js";
import { db as database } from "../db.js";

const trace = debug("arangodb#resources:trace");

const changes = database.collection(
  config.get("arangodb.collections.changes.name"),
);
const changeEdges = database.collection(
  config.get("arangodb.collections.changeEdges.name"),
);
// HACK: Should use database.graph but there is a bug with aql template tags
const changeGraph = config.get("arangodb.graphs.changes.name");

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
export type ChangeVertex = Change & {
  number: number;
  hash: string;
  userid: string;
  authorizationid: string;
};

export function assertChange(value: unknown): asserts value is Change {
  assertChangeArray([value]);
}

export async function getChanges(
  resourceId: string,
): Promise<AsyncIterable<number>> {
  return database.query<number>(
    aql`
      FOR change in ${changes}
        FILTER change.resource_id == ${resourceId}
        RETURN change.number`,
  );
}

export async function getMaxChangeRev(resourceId: string): Promise<number> {
  const cursor = await database.query(
    aql`
      RETURN FIRST(
        FOR change in ${changes}
          FILTER change.resource_id == ${resourceId}
          SORT change.number DESC
          LIMIT 1
          RETURN change.number
      )`,
  );

  return ((await cursor.next()) as number) || 0;
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
  changeRev: string | number,
): Promise<Change | undefined> {
  // FIXME: This is meant to handle when resources are deleted directly.
  // Edge cases remain to be tested.
  // Does this suffice regarding the need send down a bare tree?
  if (!changeRev) {
    return {
      resource_id: resourceId,
      path: "",
      // eslint-disable-next-line unicorn/no-null
      body: null,
      type: "delete",
    };
  }

  const cursor = await database.query(
    aql`
      LET change = FIRST(
        FOR change in ${changes}
        FILTER change.resource_id == ${resourceId}
        FILTER change.number == ${Number.parseInt(changeRev as string, 10)}
        RETURN change
      )
      LET path = LAST(
        FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change GRAPH ${changeGraph}
        RETURN p
      )
      RETURN path`,
  );

  const result = (await cursor.next()) as {
    vertices: Change[];
    edges: Array<{ path: string }>;
  };

  const firstV = result?.vertices[0];
  if (!firstV) {
    return undefined;
  }

  const change = {
    resource_id: resourceId,
    path: "",
    body: firstV.body,
    type: firstV.type,
    wasDelete: result.vertices.at(-1)?.type === "delete",
  };
  let path = "";
  for (let index = 0; index < result.vertices.length - 1; index++) {
    path += result.edges[Number(index)]?.path;
    if (change.body) {
      const { body } = result.vertices[index + 1] ?? {};
      JsonPointer.set(change.body, path, body);
    }
  }

  assertChange(change);
  return change;
}

/**
 * Produces a list of changes as an array
 */
export async function getChangeArray(
  resourceId: string,
  changeRev: string | number,
): Promise<Change[]> {
  // FIXME: This is meant to handle when resources are deleted directly.
  // Edge cases remain to be tested.
  // Does this suffice regarding the need send down a bare tree?
  if (!changeRev) {
    return [
      {
        resource_id: resourceId,
        path: "",
        // eslint-disable-next-line unicorn/no-null
        body: null,
        type: "delete",
      },
    ];
  }

  const cursor = await database.query<ChangePath>(
    aql`
      LET change = FIRST(
        FOR change in ${changes}
        FILTER change.resource_id == ${resourceId}
        FILTER change.number == ${Number.parseInt(changeRev as string, 10)}
        RETURN change
      )
      FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change GRAPH ${changeGraph}
        SORT LENGTH(p.edges), v.number
        RETURN p`,
  );
  // Iterate over the graph
  return cursor.map((document) => toChangeObject(document)); // Convert to change object
}

export interface ChangePath {
  edges: readonly ChangeEdge[];
  vertices: readonly ChangeVertex[];
}

function toChangeObject(arangoPathObject: ChangePath): Change {
  // Get path
  let path = "";
  for (const edge of arangoPathObject.edges) {
    path += edge.path;
  }

  // Get body
  const [lastV] = arangoPathObject.vertices.slice(-1);
  if (!lastV) {
    throw new Error("No vertices in arangoPathObj");
  }

  const { body, resource_id, type } = lastV;
  // Return change object
  trace({ body }, "toChangeObj: returning change object with body");
  const change = {
    resource_id,
    path,
    body,
    type,
  };
  assertChange(change);
  return change;
}

export async function getRootChange(
  resourceId: string,
  changeRev: string | number,
): Promise<{ edges: ChangeEdge[]; vertices: ChangeVertex[] }> {
  const cursor = await database.query(
    aql`
      LET change = FIRST(
        FOR change in ${changes}
        FILTER change.resource_id == ${resourceId}
        FILTER change.number == ${Number.parseInt(changeRev as string, 10)}
        RETURN change
      )
      LET path = LAST(
        FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change GRAPH ${changeGraph}
        RETURN v
      )
      RETURN path`,
  );

  return (await cursor.next()) as {
    edges: ChangeEdge[];
    vertices: ChangeVertex[];
  };
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
  change: Change["body"];
  resId: Change["resource_id"];
  rev: number | string;
  type: Change["type"];
  children: string[];
  path?: Change["path"];
  userId?: string;
  authorizationId?: string;
}): Promise<string> {
  if (!Array.isArray(children)) {
    throw new TypeError("children must be an array.");
  }

  const number = Number.parseInt(rev as string, 10);
  trace({ change }, "putChange: inserting change");
  const cursor = await database.query(
    aql`
      LET doc = FIRST(
        INSERT {
          body: ${change},
          type: ${type},
          resource_id: ${resId},
          number: ${number},
          authorization_id: ${authorizationId ?? null /* eslint-disable-line unicorn/no-null */},
          user_id: ${userId ?? null /* eslint-disable-line unicorn/no-null */}
        } IN ${changes}
        RETURN NEW
      )

      LET children = (
  FOR child IN ${children}
          INSERT {
  _to: child,
    _from: doc._id,
      path: ${path ?? null /* eslint-disable-line unicorn/no-null */}
} in ${changeEdges}
      )
      RETURN doc._id`,
  );
  return (await cursor.next()) as string;
}
