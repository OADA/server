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

import { changes, putBodies, resources } from '@oada/lib-arangodb';
import { KafkaBase, Responder } from '@oada/lib-kafka';

import type Change from '@oada/types/oada/change/v2';
import type { Resource } from '@oada/types/oada/resource';

import config from './config';

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
responder.on<WriteResponse, WriteRequest>('request', (req) => {
  if (counter++ > 500) {
    counter = 0;
    global.gc?.();
  }

  const id = req['resource_id'].replace(/^\//, '');
  const ps = locks.get(id) ?? Bluebird.resolve();

  // Run once last write finishes (whether it worked or not)
  const p = ps
    .catch(() => {
      return;
    })
    .then(() => handleReq(req))
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

export async function handleReq(req: WriteRequest): Promise<WriteResponse> {
  req.source = req.source || '';
  req.resourceExists = req.resourceExists ? req.resourceExists : false; // Fixed bug if this is undefined
  let id = req['resource_id'].replace(/^\//, '');

  // Get body and check permission in parallel
  info('Handling %s', id);
  const body = req.bodyid
    ? putBodies.getPutBody(req.bodyid)
    : Promise.resolve(req.body);

  trace('PUTing to "%s" in "%s"', req['path_leftover'], id);

  let changeType: Change[0]['type'];
  const upsert = Bluebird.resolve(body)
    .then(async function doUpsert(
      body: unknown
    ): Promise<{ rev?: number; orev?: number; changeId?: string }> {
      trace(body, 'FIRST BODY');
      if (req['if-match']) {
        const rev = ((await resources.getResource(
          req['resource_id'],
          '/_rev'
        )) as unknown) as number;
        if (req['if-match'] !== rev) {
          error(rev);
          error(req['if-match']);
          error(req);
          throw new Error('if-match failed');
        }
      }
      if (req['if-none-match']) {
        const rev = ((await resources.getResource(
          req['resource_id'],
          '/_rev'
        )) as unknown) as number;
        if (req['if-none-match'].includes(rev)) {
          error(rev);
          error(req['if-none-match']);
          error(req);
          throw new Error('if-none-match failed');
        }
      }
      let cacheRev = cache.get(req['resource_id']);
      if (!cacheRev) {
        cacheRev = ((await resources.getResource(
          req['resource_id'],
          '/_rev'
        )) as unknown) as number;
      }
      if (req.rev) {
        if (cacheRev !== req.rev) {
          throw new Error('rev mismatch');
        }
      }

      let path = pointer.parse(req['path_leftover']);
      let method = resources.putResource;
      changeType = 'merge';
      const obj: DeepPartial<Resource> = {};

      // Perform delete
      if (body === undefined) {
        trace('Body is undefined, doing delete');
        if (path.length > 0) {
          trace('Delete path = %s', path);
          // TODO: This is gross
          const ppath = Array.from(path);
          method = (id, obj) => resources.deletePartialResource(id, ppath, obj);
          trace(
            'Setting method = deletePartialResource(%s, %o, %O)',
            id,
            ppath,
            obj
          );
          body = null;
          changeType = 'delete';
          trace(`Setting changeType = 'delete'`);
        } else {
          if (!req.resourceExists) {
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
        req.resource_id,
        req.resourceExists
      );
      if (req.resourceExists === false) {
        trace(
          'initializing arango: resource_id = ' +
            req.resource_id +
            ', path_leftover = ' +
            req.path_leftover
        );
        id = req.resource_id.replace(/^\//, '');
        path = path.slice(2);

        // Initialize resource stuff
        Object.assign(obj, {
          _type: req['contentType'],
          _meta: {
            _id: id + '/_meta',
            _type: req['contentType'],
            _owner: req['user_id'],
            stats: {
              createdBy: req['user_id'],
              created: ts,
            },
          },
        });
        trace(obj, 'Intializing resource');
      }

      // Create object to recursively merge into the resource
      trace(path, 'Recursively merging path into arango object');
      const endk = path.pop();
      if (endk !== undefined) {
        let o = obj as Record<string, unknown>;
        path.forEach((k) => {
          trace('Adding path for key %s', k);
          if (!(k in o)) {
            // TODO: Support arrays better?
            o[k] = {};
          }
          o = o[k] as Record<string, unknown>;
        });
        o[endk] = body as DeepPartial<Resource>;
      } else {
        objectAssignDeep(obj, body);
      }
      trace(obj, 'Setting body on arango object');

      // Update meta
      const meta: Partial<Resource['_meta']> & Record<string, unknown> = {
        modifiedBy: req['user_id'],
        modified: ts,
      };
      obj['_meta'] = objectAssignDeep(obj['_meta'] || {}, meta);

      // Increment rev number
      let rev = parseInt((cacheRev || 0) as string, 10) + 1;

      // If rev is supposed to be set to 1, this is a "new" resource.  However,
      // change feed could still be around from an earlier delete, so check that
      // and set rev to more than biggest one
      if (rev === 1) {
        const changerev = await changes.getMaxChangeRev(id);
        if (changerev && changerev > 1) {
          rev = +changerev + 1;
          trace(
            'Found old changes (max rev %d) for new resource, setting initial _rev to %d include them',
            changerev,
            rev
          );
        }
      }

      obj['_rev'] = rev;
      pointer.set(obj, '/_meta/_rev', rev);

      // Compute new change
      const children = req['from_change_id'] || [];
      trace(obj, 'Putting change');
      const changeId = await changes.putChange({
        change: { ...obj, _rev: rev },
        resId: id,
        rev,
        type: changeType,
        children,
        path: req['change_path'],
        userId: req['user_id'],
        authorizationId: req['authorizationid'],
      });
      pointer.set(obj, '/_meta/_changes', {
        _id: id + '/_meta/_changes',
        _rev: rev,
      });

      // Update rev of meta?
      obj['_meta']['_rev'] = rev;

      return await method(id, obj, !req.ignoreLinks).then((orev) => ({
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
        user_id: req['user_id'],
        authorizationid: req['authorizationid'],
        path_leftover: req['path_leftover'],
        contentType: req['contentType'],
        indexer: req['indexer'],
        change_id: changeId,
      };
      // causechain comes from rev-graph-update
      if (req.causechain) res.causechain = req.causechain; // pass through causechain if present
      return res;
    })
    .catch(resources.NotFoundError, function respondNotFound(err) {
      error(err);
      return {
        msgtype: 'write-response',
        code: 'not_found',
        user_id: req['user_id'],
        authorizationid: req['authorizationid'],
      };
    })
    .catch(function respondErr(err: unknown) {
      error(err);
      const { message = 'error' } = err as { message?: string };
      return {
        msgtype: 'write-response',
        code: message,
        user_id: req['user_id'],
        authorizationid: req['authorizationid'],
      };
    });

  const cleanup = body.then(async () => {
    // Remove putBody, if there was one
    // const result = req.bodyid && putBodies.removePutBody(req.bodyid);
    return req.bodyid && putBodies.removePutBody(req.bodyid);
  });
  await cleanup;

  // TODO: Better return type for this function
  return (await upsert) as WriteResponse;
}
