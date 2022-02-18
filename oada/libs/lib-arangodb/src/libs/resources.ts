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

/* eslint-disable @typescript-eslint/ban-types */

import type { Link } from '@oada/types/oada/link/v1';
import type Resource from '@oada/types/oada/resource';

import config from '../config.js';

import { OADAified, oadaify } from '@oada/oadaify';

import { User, findById } from './users.js';
import { db as database } from '../db.js';
import { sanitizeResult } from '../util.js';

import { ArangoError } from 'arangojs/error';
import { JsonPointer } from 'json-ptr';
import { aql } from 'arangojs';
import cloneDeep from 'clone-deep';
import debug from 'debug';

type IResource = OADAified<Resource>;
export { IResource as Resource };

const info = debug('arangodb#resources:info');
const trace = debug('arangodb#resources:trace');

const resources = database.collection(
  config.get('arangodb.collections.resources.name')
);
const graphNodes = database.collection(
  config.get('arangodb.collections.graphNodes.name')
);
const edgesCollection = database.collection(
  config.get('arangodb.collections.edges.name')
);

const MAX_DEPTH = 100; // TODO: Is this good?

type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

export interface Permission {
  type: string;
  owner: string;
  read: boolean;
  write: boolean;
}

export interface GraphLookup {
  type?: string;
  rev: number;
  resource_id: string;
  path_leftover: string;
  permissions: Partial<Permission>;
  from?: Omit<GraphLookup, 'rev'>;
  resourceExists: boolean;
}

function normalizeUrl(user: User, url: string): string {
  if (url.startsWith('/bookmarks')) {
    return url.replace(/^\/bookmarks/, `/${user.bookmarks._id}`);
  }

  if (url.startsWith('/shares')) {
    return url.replace(/^\/shares/, `/${user.shares._id}`);
  }

  return url;
}

export async function lookupFromUrl(
  path: string,
  userId: string
): Promise<GraphLookup> {
  const user = await findById(userId);
  if (!user) {
    throw new Error(`No User Found for given userId ${userId}`);
  }

  const url = normalizeUrl(user, path);

  //    Trace(userId);
  const pieces = JsonPointer.decode(url);
  if (!(pieces[0] && pieces[1])) {
    throw new Error(`Failed to parse URL ${url}`);
  }

  // Resources/123 => graphNodes/resources:123
  const startNode = `${graphNodes.name}/${pieces[0]}:${pieces[1]}`;
  const id = pieces.splice(0, 2);
  // Create a filter for each segment of the url
  let filters = aql``;
  for (const [index, urlPiece] of Object.entries(pieces)) {
    // Need to be sure `i` is a number and not a string
    // otherwise indexes don't work...
    filters = aql`
      ${filters}
      FILTER p.edges[${Number(index)}].name == ${urlPiece} || p.edges[${Number(
      index
    )}].name == null`;
  }

  const query = aql`
    WITH ${edgesCollection}, ${graphNodes}
    LET path = LAST(
      FOR v, e, p IN 0..${pieces.length} OUTBOUND ${startNode} ${edgesCollection}
        ${filters}
        RETURN p
    )
    LET resources = DOCUMENT(path.vertices[*].resource_id)
    LET type = null
    LET permissions = (
      FOR r IN resources
      RETURN {
        type: r._type || type,
        owner: r._meta._owner == ${userId} || r._meta._permissions[${userId}].owner,
        read: r._meta._owner == ${userId} || r._meta._permissions[${userId}].read,
        write: r._meta._owner == ${userId} || r._meta._permissions[${userId}].write
      }
    )
    LET rev = DOCUMENT(LAST(path.vertices).resource_id)._oada_rev
    RETURN MERGE(path, {permissions, rev, type})`;
  const cursor = await database.query(query);
  const result: {
    rev: number;
    type: string | null;
    permissions: Array<Nullable<Permission>>;
    vertices:
      | ReadonlyArray<{
          resource_id: string;
          is_resource: boolean;
          path?: string;
        }>
      | [null];
    edges:
      | ReadonlyArray<{
          _to: string;
          _from: string;
          name: string;
          versioned: boolean;
        }>
      | [null];
  } = (await cursor.next()) as {
    rev: number;
    type: string | null;
    permissions: Array<Nullable<Permission>>;
    vertices:
      | ReadonlyArray<{
          resource_id: string;
          is_resource: boolean;
          path?: string;
        }>
      | [null];
    edges:
      | ReadonlyArray<{
          _to: string;
          _from: string;
          name: string;
          versioned: boolean;
        }>
      | [null];
  };

  // Get rid of leading slash from json pointer
  let resource_id = JsonPointer.create(id.concat(pieces))
    .toString()
    .replace(/^\//, '');

  let { rev, type, edges, vertices } = result;
  let resourceExists = true;

  let path_leftover = '';
  let from;

  if (!result) {
    trace('1 return resource id %s', resource_id);
    return {
      resourceExists: false,
      permissions: {},
      resource_id,
      path_leftover,
      from,
      rev,
    };
  }

  // Walk up and find the graph and return furthest known permissions (and
  // type)
  const permissions: {
    owner?: string;
    read?: boolean;
    write?: boolean;
    type?: string;
  } = {
    owner: undefined,
    read: undefined,
    write: undefined,
    type: undefined,
  };
  result.permissions.reverse().some((p) => {
    if (p) {
      if (permissions.read === undefined) {
        permissions.read = p.read === null ? undefined : p.read;
      }

      if (permissions.write === undefined) {
        permissions.read = p.write === null ? undefined : p.write;
      }

      if (permissions.owner === undefined) {
        permissions.owner = p.owner === null ? undefined : p.owner;
      }

      if (permissions.type === undefined) {
        permissions.type = p.type === null ? undefined : p.type;
      }

      if (
        permissions.read !== undefined &&
        permissions.write !== undefined &&
        permissions.owner !== undefined &&
        permissions.type !== undefined
      ) {
        return true;
      }
    }

    return false;
  });
  type = permissions.type ?? null;

  // Check for a traversal that did not finish (aka not found)
  if (vertices[0] === null) {
    trace('graph-lookup traversal did not finish');
    trace('2 return resource id %s', resource_id);

    return {
      resource_id,
      path_leftover,
      from,
      permissions,
      rev,
      type: type ?? undefined,
      resourceExists: false,
    };
  }

  const [lastV] = vertices.slice(-1);
  // A dangling edge indicates uncreated resource; return graph lookup
  // starting at this uncreated resource
  if (lastV) {
    resource_id = lastV.resource_id;
    trace('graph-lookup traversal found resource %s', resource_id);
    const fromV = vertices[vertices.length - 2];
    const edge = edges[edges.length - 1];
    // If the desired url has more pieces than the longest path, the
    // pathLeftover is the extra pieces
    if (vertices.length - 1 < pieces.length) {
      const revVertices = Array.from(cloneDeep(vertices)).reverse();
      const lastResource =
        vertices.length - 1 - revVertices.findIndex((v) => v?.is_resource);
      // Slice a negative value to take the last n pieces of the array
      path_leftover = JsonPointer.create(
        pieces.slice(lastResource - pieces.length)
      ).toString();
    } else {
      path_leftover = lastV.path ?? '';
    }

    from = {
      permissions,
      resourceExists: Boolean(fromV),
      resource_id: fromV?.resource_id ?? '',
      path_leftover: (fromV?.path ?? '') + (edge ? `/${edge.name}` : ''),
    };
  } else {
    const lastEdge = edges[edges.length - 1]?._to;
    path_leftover = '';
    resource_id = `resources/${
      lastEdge?.split('graphNodes/resources:')[1] ?? ''
    }`;
    trace('graph-lookup traversal uncreated resource %s', resource_id);
    rev = 0;
    const fromV = vertices[vertices.length - 2];
    const edge = edges[edges.length - 1];
    from = {
      resourceExists: Boolean(fromV),
      permissions,
      resource_id: fromV?.resource_id ?? '',
      path_leftover: (fromV?.path ?? '') + (edge ? `/${edge.name}` : ''),
    };
    resourceExists = false;
  }

  return {
    type: type ?? undefined,
    rev,
    resource_id,
    path_leftover,
    permissions,
    from,
    resourceExists,
  };
}

export async function getResource(
  id: string,
  path?: ''
): Promise<IResource | undefined>;
export async function getResource(
  id: string,
  path: string
): Promise<Partial<IResource> | undefined>;
export async function getResource(
  id: string,
  path = ''
): Promise<Partial<IResource> | undefined> {
  // TODO: Escaping stuff?
  const parts = JsonPointer.decode(path);

  if (parts[0] === '_rev') {
    // Get OADA rev, not arango one
    parts[0] = '_oada_rev';
  }

  const bindVariables = {
    ...Object.fromEntries(parts.map((part, index) => [`v${index}`, part])),
    id,
    '@collection': resources.name,
  };
  const returnPath = parts.map((_, index) => `[@v${index}]`).join('');

  try {
    const result = await database.query({
      // TODO: Fix this thing to use aql...
      query: `
        WITH ${resources.name}
        FOR r IN @@collection
          FILTER r._id == @id
          RETURN r${returnPath}`,
      bindVars: bindVariables,
    });
    return oadaify(sanitizeResult(await result.next()), false);
  } catch (error: unknown) {
    if (
      error instanceof ArangoError &&
      error.message === 'invalid traversal depth (while instantiating plan)'
    ) {
      // Treat non-existing path as not-found
      return undefined;
    }

    throw error as Error;
  }
}

interface OwnerIdRev {
  _rev: number;
  _id: string;
  _meta: {
    _owner: string;
  };
}
export async function getResourceOwnerIdRev(
  id: string
): Promise<OwnerIdRev | undefined> {
  try {
    const result = await database.query(aql`
      WITH ${resources}
      FOR r IN ${resources}
        FILTER r._id == ${id}
        RETURN {
          _rev: r._oada_rev,
          _id: r._id,
          _meta: { _owner: r._meta._owner }
        }`);

    const object = (await result.next()) as OwnerIdRev | undefined;
    trace('getResourceOwnerIdRev(%s): result = %O', id, object);
    return object;
  } catch (error: unknown) {
    if (
      error instanceof ArangoError &&
      error.message === 'invalid traversal depth (while instantiating plan)'
    ) {
      // Treat non-existing path as not-found
      return undefined;
    }

    throw error as Error;
  }
}

export async function getParents(id: string) {
  try {
    const cursor = await database.query(
      aql`
        WITH ${edgesCollection}, ${graphNodes}, ${resources}
        FOR v, e IN 0..1
          INBOUND ${
            // eslint-disable-next-line sonarjs/no-nested-template-literals
            `graphNodes/${id.replace(/\//, ':')}`
          }
          ${edgesCollection}
          FILTER e.versioned == true
          LET res = DOCUMENT(v.resource_id)
          RETURN {
            resource_id: v.resource_id,
            path: CONCAT(v.path || '', '/', e.name),
            contentType: res._type
          }`
    );
    return cursor as AsyncIterableIterator<{
      resource_id: string;
      path: string;
      contentType: string;
    }>;
  } catch (error: unknown) {
    if (
      error instanceof ArangoError &&
      error.message === 'invalid traversal depth (while instantiating plan)'
    ) {
      // Treat non-existing path as no parents?
      return (async function* () {
        // Empty async iterable iterator
      })();
    }

    throw error as Error;
  }
}

export async function getNewDescendants(id: string, rev: string | number) {
  const cursor = await database.query(
    aql`
        WITH ${graphNodes}, ${edgesCollection}, ${resources}
        LET node = FIRST(
          FOR node in ${graphNodes}
            FILTER node.resource_id == ${id}
            RETURN node
        )

        FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND node ${edgesCollection}
          FILTER p.edges[*].versioned ALL == true
          FILTER v.is_resource
          LET ver = SPLIT(DOCUMENT(LAST(p.vertices).resource_id)._oada_rev, '-', 1)
          // FILTER TO_NUMBER(ver) >= ${Number.parseInt(rev as string, 10)}
          RETURN DISTINCT {
            id: v.resource_id,
            changed: TO_NUMBER(ver) >= ${Number.parseInt(rev as string, 10)}
          }`
  );
  return cursor as AsyncIterableIterator<{ id: string; changed: boolean }>;
}

export async function getChanges(id: string, rev: string | number) {
  // Currently utilizes fixed depth search "7..7" to get data points down
  const cursor = await database.query(
    aql`
        WITH ${graphNodes}, ${edgesCollection}, ${resources}
        LET node = FIRST(
          FOR node in ${graphNodes}
            FILTER node.resource_id == ${id}
            RETURN node
        )

        LET objs = (FOR v, e, p IN 7..7 OUTBOUND node ${edgesCollection}
          FILTER v.is_resource
          LET ver = SPLIT(DOCUMENT(v.resource_id)._oada_rev, '-', 1)
          FILTER TO_NUMBER(ver) >= ${Number.parseInt(rev as string, 10)}
          RETURN DISTINCT {
            id: v.resource_id,
            rev: DOCUMENT(v.resource_id)._oada_rev
          }
        )
        FOR obj in objs
          LET doc = DOCUMENT(obj.id)
          RETURN {id: obj.id, changes: doc._meta._changes[obj.rev]}`
  );
  return cursor as AsyncIterableIterator<{ id: string; changes: string }>;
}

export async function putResource(
  id: string,
  object: Record<string, unknown>,
  checkLinks = true
): Promise<number> {
  // Fix rev
  object._oada_rev = object._rev;
  object._rev = undefined;

  // TODO: Sanitize OADA keys?
  // _key is now an illegal document key
  object._key = id.replace(/^\/?resources\//, '');
  trace('Adding links for resource %s...', id);

  const links = checkLinks ? await addLinks(object) : [];
  info('Upserting resource %s', object._key);
  trace(links, 'Upserting links');

  // TODO: Should it check that graphNodes exist but are wrong?
  let q;
  if (links.length > 0) {
    const thingy = aql`
      LET reskey = ${object._key as string}
      LET resUp = FIRST(
        LET res = ${object}
        UPSERT { '_key': reskey }
        INSERT res
        UPDATE res
        IN ${resources}
        RETURN { res: NEW, orev: OLD._oada_rev }
      )
      LET res = resUp.res
      FOR l IN ${links}
        LET lKey = SUBSTRING(l._id, LENGTH('resources/'))
        LET nodeids = FIRST(
          LET nodeids = (
            LET nodeids = APPEND([reskey], SLICE(l.path, 0, -1))
            FOR i IN 1..LENGTH(nodeids)
              LET path = CONCAT_SEPARATOR(':', SLICE(nodeids, 0, i))
              RETURN CONCAT('resources:', path)
          )
          LET end = CONCAT('resources:', lKey)
          RETURN APPEND(nodeids, [end])
        )
        LET nodes = APPEND((
          FOR i IN 0..(LENGTH(l.path)-1)
            LET isResource = i IN [0, LENGTH(l.path)]
            LET pPath = SLICE(l.path, 0, i)
            LET resId = i == LENGTH(l.path) ? lKey : reskey
            LET path = isResource ? null
                : CONCAT_SEPARATOR('/', APPEND([''], pPath))
            UPSERT { '_key': nodeids[i] }
            INSERT {
              '_key': nodeids[i],
              'is_resource': isResource,
              'path': path,
              'resource_id': res._id
            }
            UPDATE {}
            IN ${graphNodes}
            OPTIONS { ignoreErrors: true }
            RETURN NEW
        ), { _id: CONCAT('graphNodes/', LAST(nodeids)), is_resource: true })
        LET edges = (
          FOR i IN 0..(LENGTH(l.path)-1)
            UPSERT {
              '_from': nodes[i]._id,
              'name': l.path[i]
            }
            INSERT {
              '_from': nodes[i]._id,
              '_to': nodes[i+1]._id,
              'name': l.path[i],
              'versioned': nodes[i+1].is_resource && HAS(l, '_rev')
            }
            UPDATE {
              '_to': nodes[i+1]._id,
              'versioned': nodes[i+1].is_resource && HAS(l, '_rev')
            }
            IN ${edgesCollection}
            RETURN NEW
        )
        RETURN resUp.orev`;

    q = await database.query(thingy);
  } else {
    q = await database.query(aql`
      LET resUp = FIRST(
        LET res = ${object}
        UPSERT { '_key': res._key }
        INSERT res
        UPDATE res
        IN ${resources}
        return { res: NEW, orev: OLD._oada_rev }
      )
      LET res = resUp.res
      LET nodekey = CONCAT('resources:', res._key)
      UPSERT { '_key': nodekey }
      INSERT {
        '_key': nodekey,
        'is_resource': true,
        'resource_id': res._id
      }
      UPDATE {}
      IN ${graphNodes}
      OPTIONS {exclusive: true, ignoreErrors: true }
      RETURN resUp.orev`);
  }

  return (await q.next()) as number;
}

async function forLinks(
  resource: Record<string, unknown>,
  callback: (link: Link, path: readonly string[]) => void | Promise<void>,
  path: string[] = []
): Promise<void> {
  await Promise.all(
    Object.entries(resource).map(async ([key, value]) => {
      if (value && typeof value === 'object') {
        if ('_id' in value && key !== '_meta') {
          // If it has _id and is not _meta, treat as a link
          await callback(value as Link, path.concat(key));
          return;
        }

        await forLinks(
          value as Record<string, unknown>,
          callback,
          path.concat(key)
        );
      }
    })
  );
}

// TODO: Remove links as well
async function addLinks(resource: Record<string, unknown>) {
  // TODO: Use fewer queries or something?
  const links: Link[] = [];
  await forLinks(resource, async (link, path) => {
    // Ignore _changes "link"?
    if (path[0] === '_meta' && path[1] === '_changes') {
      return;
    }

    if ('_rev' in link) {
      const rev = await getResource(link._id, '/_oada_rev');
      link._rev = typeof rev === 'number' ? rev : 0;
    }

    links.push({ path, ...link });
  });

  return links;
}

export async function makeRemote<T extends Record<string, unknown>>(
  resource: T,
  domain: string
): Promise<T> {
  await forLinks(resource, (link) => {
    // Change all links to remote links
    link._rid = link._id;
    link._rrev = link._rev;
    // @ts-expect-error nonsense
    delete link._id;
    delete link._rev;
    link._rdomain = domain;
  });

  return resource;
}

export async function deleteResource(id: string): Promise<number> {
  // TODO: fix this: for some reason, the id that came in started with
  /// resources, unlike everywhere else in this file
  const key = id.replace(/^\/?resources\//, '');

  // Query deletes resource, its nodes, and outgoing edges (but not incoming)
  const cursor = await database.query(
    aql`
        LET res = FIRST(
          REMOVE { '_key': ${key} } IN ${resources}
          RETURN OLD
        )
        LET nodes = (
          FOR node in ${graphNodes}
            FILTER node['resource_id'] == res._id
            REMOVE node IN ${graphNodes}
            RETURN OLD
        )
        LET edges = (
          FOR node IN nodes
            FOR edge IN ${edgesCollection}
              FILTER edge['_from'] == node._id
              REMOVE edge IN ${edgesCollection}
        )
        RETURN res._oada_rev`
  );
  return (await cursor.next()) as number;
}

/**
 * "Delete" a part of a resource
 */
export async function deletePartialResource(
  id: string,
  path: string | string[],
  document: Partial<Resource> = {}
): Promise<number> {
  const key = id.replace(/^resources\//, '');
  const pointer = new JsonPointer(path);
  const aPath = Array.isArray(path) ? path : pointer.path;

  // TODO: Less gross way to check existence of JSON pointer in AQL??
  let pathA = aPath.slice(0, -1).join("']['");
  pathA = pathA ? `['${pathA}']` : pathA;
  const [pathB] = aPath.slice(-1) as [string];
  const stringA = `(res${pathA}, '${pathB}')`;
  const hasString = `HAS${stringA}`;

  const rev = document._rev;
  pointer.set(document, null);

  const name = aPath.pop();
  const sPath = JsonPointer.create(aPath).toString() || null;
  const cursor = await database.query({
    query: `
        LET res = DOCUMENT(${resources.name}, '${key}')
        LET has = ${hasString}

        RETURN {has, rev: res._oada_rev}`,
    bindVars: {},
  });
  const hasObject = (await cursor.next()) as { has: boolean; rev: number };
  if (hasObject.has) {
    // TODO: Why the heck does arango error if I update resource before graph?
    const updateCursor = await database.query(
      aql`
          LET start = FIRST(
            FOR node IN ${graphNodes}
              LET path = node.path || null
              FILTER node['resource_id'] == ${id} AND path == ${sPath}
              RETURN node._id
          )
          LET vs = (
            FOR v, e, p IN 1..${MAX_DEPTH} OUTBOUND start ${edgesCollection}
              OPTIONS { bfs: true, uniqueVertices: 'global' }
              FILTER p.edges[0].name == ${name}
              FILTER p.vertices[*].resource_id ALL == ${id}
              RETURN v._id
          )

          LET estart = (
            FOR v, e IN 1..1 OUTBOUND start ${edgesCollection}
              FILTER e.name == ${name}
              RETURN e
          )
          LET ev = (
            FOR vd IN vs
              FOR v, e IN 1..1 ANY vd ${edgesCollection}
                RETURN e
          )

          LET es = (
            FOR e IN APPEND(ev, estart)
              REMOVE e IN ${edgesCollection}
          )
          LET vd = (
            FOR v IN vs
              REMOVE v IN ${graphNodes}
          )

          LET newres = MERGE_RECURSIVE(
            ${document},
            {
              _oada_rev: ${rev},
              _meta: {_rev: ${rev}}
            }
          )
          UPDATE ${key} WITH newres IN ${resources} OPTIONS { keepNull: false }
          RETURN OLD._oada_rev`
    );
    return (await updateCursor.next()) as number;
  }

  return hasObject.rev;
}
