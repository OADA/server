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

import { changes, putBodies, resources } from '@oada/lib-arangodb';
import { KafkaBase, Responder } from '@oada/lib-kafka';

import type Change from '@oada/types/oada/change/v2';
import type { Resource } from '@oada/types/oada/resource';

import config from './config.js';

import Bluebird from 'bluebird';
import debug from 'debug';
import pointer from 'json-pointer';
import objectAssignDeep from 'object-assign-deep';
import Cache from 'timed-cache';

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

const error = debug('write-handler:error');
const info = debug('write-handler:info');
const trace = debug('write-handler:trace');

let counter = 0;

const responder = new Responder({
  consumeTopic: config.get('kafka.topics.writeRequest'),
  produceTopic: config.get('kafka.topics.httpResponse'),
  group: 'write-handlers',
});

// Only run one write at a time?
// Per-resource write locks/queues
const locks: Map<string, Bluebird<unknown>> = new Map();
const cache = new Cache<number | string>({ defaultTtl: 60 * 1000 });
responder.on<WriteResponse, WriteRequest>('request', (request) => {
  if (counter++ > 500) {
    counter = 0;
    global.gc?.();
  }

  const id = request.resource_id.replace(/^\//, '');
  const ps = locks.get(id) ?? Bluebird.resolve();

  // Run once last write finishes (whether it worked or not)
  const p = ps
    .catch(() => {})
    .then(async () => handleReq(request))
    .finally(() => {
      // Clean up if queue empty
      if (locks.get(id) === p) {
        // Our write has finished AND no others queued for this id
        locks.delete(id);
      }
    });
  locks.set(id, p);

  return p;
});

/**
 * Data passed from request to response
 */
interface WriteContext {
  /**
   * @todo what is this?
   */
  indexer?: unknown;
  /**
   * @todo what is this?
   */
  causechain?: string;
  /**
   * ID of user performing the write
   */
  user_id?: string;
  /**
   * ID of the authorization (token) performing the write
   */
  authorizationid?: string;
  /**
   * Content type of the body being written
   */
  contentType: string;
  resource_id: string;
  path_leftover: string;
}

/**
 * Interface for expected request objects
 */
export interface WriteRequest extends WriteContext {
  'source'?: string;
  'rev'?: number;
  /**
   * Wether the resource being written already exists
   */
  'resourceExists'?: boolean;
  /**
   * ID for fetching write body from DB
   */
  'bodyid'?: string;
  /**
   * Write body value (instead of fetching one from DB)
   */
  'body'?: unknown;
  /**
   * Wether to ignore any contained links in the write
   */
  'ignoreLinks'?: boolean;
  /**
   * Rev which must match current rev before write
   */
  'if-match'?: number;
  /**
   * Revs which must not match current rev before write
   */
  'if-none-match'?: number[];
  // Change stuff?...
  /**
   * @todo what is this?
   */
  'change_path'?: string;
  /**
   * @todo what is this?
   */
  'from_change_id'?: string[];
}

/**
 * Response to a write request
 */
export interface WriteResponse extends KafkaBase, WriteContext {
  msgtype: 'write-response';
  _rev: number;
  _orev?: number;
  change_id?: string;
}

export async function handleReq(request: WriteRequest): Promise<WriteResponse> {
  request.source = request.source || '';
  request.resourceExists = request.resourceExists
    ? request.resourceExists
    : false; // Fixed bug if this is undefined
  let id = request.resource_id.replace(/^\//, '');

  // Get body and check permission in parallel
  info('Handling %s', id);
  const body = request.bodyid
    ? putBodies.getPutBody(request.bodyid)
    : Promise.resolve(request.body);

  trace('PUTing to "%s" in "%s"', request.path_leftover, id);

  let changeType: Change[0]['type'];
  const upsert = Bluebird.resolve(body)
    .then(async function doUpsert(
      body: unknown
    ): Promise<{ rev?: number; orev?: number; changeId?: string }> {
      trace(body, 'FIRST BODY');
      if (request['if-match']) {
        const rev = (await resources.getResource(
          request.resource_id,
          '/_rev'
        )) as unknown as number;
        if (request['if-match'] !== rev) {
          error(rev);
          error(request['if-match']);
          error(request);
          throw new Error('if-match failed');
        }
      }

      if (request['if-none-match']) {
        const rev = (await resources.getResource(
          request.resource_id,
          '/_rev'
        )) as unknown as number;
        if (request['if-none-match'].includes(rev)) {
          error(rev);
          error(request['if-none-match']);
          error(request);
          throw new Error('if-none-match failed');
        }
      }

      let cacheRev = cache.get(request.resource_id);
      if (!cacheRev) {
        cacheRev = (await resources.getResource(
          request.resource_id,
          '/_rev'
        )) as unknown as number;
      }

      if (request.rev && cacheRev !== request.rev) {
        throw new Error('rev mismatch');
      }

      let path = pointer.parse(request.path_leftover);
      let method = resources.putResource;
      changeType = 'merge';
      const object: DeepPartial<Resource> = {};

      // Perform delete
      if (body === undefined) {
        trace('Body is undefined, doing delete');
        if (path.length > 0) {
          trace('Delete path = %s', path);
          // TODO: This is gross
          const aPath = Array.from(path);
          method = async (id, object_) =>
            resources.deletePartialResource(id, aPath, object_);
          trace(
            'Setting method = deletePartialResource(%s, %o, %O)',
            id,
            aPath,
            object
          );
          body = null;
          changeType = 'delete';
          trace(`Setting changeType = 'delete'`);
        } else {
          if (!request.resourceExists) {
            return { rev: undefined, orev: undefined, changeId: undefined };
          }

          trace('deleting resource altogether');
          const orev = await resources.deleteResource(id);
          return { orev };
        }
      }

      const ts = Date.now() / 1000;
      // TODO: Sanitize keys?

      trace(
        '%s: Checking if resource exists (req.resourceExists = %o)',
        request.resource_id,
        request.resourceExists
      );
      if (request.resourceExists === false) {
        trace(
          `initializing arango: resource_id = ${request.resource_id}, path_leftover = ${request.path_leftover}`
        );
        id = request.resource_id.replace(/^\//, '');
        path = path.slice(2);

        // Initialize resource stuff
        Object.assign(object, {
          _type: request.contentType,
          _meta: {
            _id: `${id}/_meta`,
            _type: request.contentType,
            _owner: request.user_id,
            stats: {
              createdBy: request.user_id,
              created: ts,
            },
          },
        });
        trace(object, 'Intializing resource');
      }

      // Create object to recursively merge into the resource
      trace(path, 'Recursively merging path into arango object');
      const endK = path.pop();
      if (endK !== undefined) {
        let o = object as Record<string, unknown>;
        for (const k of path) {
          trace('Adding path for key %s', k);
          if (!(k in o)) {
            // TODO: Support arrays better?
            o[k] = {};
          }

          o = o[k] as Record<string, unknown>;
        }

        o[endK] = body as DeepPartial<Resource>;
      } else {
        objectAssignDeep(object, body);
      }

      trace(object, 'Setting body on arango object');

      // Update meta
      const meta: Partial<Resource['_meta']> & Record<string, unknown> = {
        modifiedBy: request.user_id,
        modified: ts,
      };
      object._meta = objectAssignDeep(object._meta || {}, meta);

      // Increment rev number
      let rev = Number.parseInt((cacheRev || 0) as string, 10) + 1;

      // If rev is supposed to be set to 1, this is a "new" resource.  However,
      // change feed could still be around from an earlier delete, so check that
      // and set rev to more than biggest one
      if (rev === 1) {
        const changerev = await changes.getMaxChangeRev(id);
        if (changerev && changerev > 1) {
          rev = Number(changerev) + 1;
          trace(
            'Found old changes (max rev %d) for new resource, setting initial _rev to %d include them',
            changerev,
            rev
          );
        }
      }

      object._rev = rev;
      pointer.set(object, '/_meta/_rev', rev);

      // Compute new change
      const children = request.from_change_id || [];
      trace(object, 'Putting change');
      const changeId = await changes.putChange({
        change: { ...object, _rev: rev },
        resId: id,
        rev,
        type: changeType,
        children,
        path: request.change_path,
        userId: request.user_id,
        authorizationId: request.authorizationid,
      });
      pointer.set(object, '/_meta/_changes', {
        _id: `${id}/_meta/_changes`,
        _rev: rev,
      });

      // Update rev of meta?
      object._meta._rev = rev;

      return method(id, object, !request.ignoreLinks).then((orev) => ({
        rev,
        orev,
        changeId,
      }));
    })
    .then(function respond({
      rev,
      orev,
      changeId,
    }: {
      rev?: number;
      orev?: number;
      changeId?: string;
    }) {
      if (rev) {
        // Put the new rev into the cache
        cache.put(id, rev);
      }

      const res: WriteResponse = {
        msgtype: 'write-response',
        code: 'success',
        resource_id: id,
        _rev: typeof rev === 'number' ? rev : 0,
        _orev: orev,
        user_id: request.user_id,
        authorizationid: request.authorizationid,
        path_leftover: request.path_leftover,
        contentType: request.contentType,
        indexer: request.indexer,
        change_id: changeId,
      };
      // Causechain comes from rev-graph-update
      if (request.causechain) res.causechain = request.causechain; // Pass through causechain if present
      return res;
    })
    .catch(resources.NotFoundError, function respondNotFound(error_) {
      error(error_);
      return {
        msgtype: 'write-response',
        code: 'not_found',
        user_id: request.user_id,
        authorizationid: request.authorizationid,
      };
    })
    .catch(function respondError(error_: unknown) {
      error(error_);
      const { message = 'error' } = error_ as { message?: string };
      return {
        msgtype: 'write-response',
        code: message,
        user_id: request.user_id,
        authorizationid: request.authorizationid,
      };
    });

  const cleanup = body.then(
    async () =>
      // Remove putBody, if there was one
      // const result = req.bodyid && putBodies.removePutBody(req.bodyid);
      request.bodyid && putBodies.removePutBody(request.bodyid)
  );
  await cleanup;

  // TODO: Better return type for this function
  return (await upsert) as WriteResponse;
}
