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

import "@oada/pino-debug";

import { config } from "./config.js";

import "@oada/lib-prom";

import {
  ArangoError,
  ArangoErrorCode,
  changes,
  putBodies,
  resources,
} from "@oada/lib-arangodb";
import type { KafkaBase } from "@oada/lib-kafka";
import { Responder } from "@oada/lib-kafka";

import type Resource from "@oada/types/oada/resource.js";

import Cache from "timed-cache";
import { JsonPointer } from "json-ptr";
import type { PathSegments } from "json-ptr";
import debug from "debug";
import objectAssignDeep from "object-assign-deep";

type DeepPartial<T> = { [K in keyof T]?: DeepPartial<T[K]> };

const error = debug("write-handler:error");
const info = debug("write-handler:info");
const trace = debug("write-handler:trace");

/**
 * Create reusable JSON pointers
 */
const metaPointers = {
  /**
   * Reusable JSON Pointer to `/_meta/_rev`
   */
  rev: JsonPointer.create("/_meta/_rev"),
  /**
   * Reusable JSON Pointer to `/_meta/_type`
   */
  type: JsonPointer.create("/_meta/_type"),
  /**
   * Reusable JSON Pointer to `/_meta/_changes`
   */
  changes: JsonPointer.create("/_meta/_changes"),
  /**
   * Reusable JSON Pointer to `/_meta/modifiedBy`
   */
  modifiedBy: JsonPointer.create("/_meta/modifiedBy"),
  /**
   * Reusable JSON Pointer to `/_meta/modified`
   */
  modified: JsonPointer.create("/_meta/modified"),
} as const;

let counter = 0;

const responder = new Responder<WriteRequest>({
  consumeTopic: config.get("kafka.topics.writeRequest"),
  produceTopic: config.get("kafka.topics.httpResponse"),
  group: "write-handlers",
});

// Only run one write at a time?
// Per-resource write locks/queues
const locks = new Map<string, Promise<WriteResponse | void>>();
const cache = new Cache<number | string>({ defaultTtl: 60 * 1000 });
responder.on<WriteResponse>("request", async (request) => {
  if (counter++ > 500) {
    counter = 0;
    globalThis.gc?.();
  }

  const id = request.resource_id.replace(/^\//, "");
  const ps = locks.get(id) ?? Promise.resolve();

  // Run once last write finishes (whether it worked or not)
  const p = ps
    // eslint-disable-next-line github/no-then
    .catch(() => {})
    // eslint-disable-next-line github/no-then
    .then(async () => {
      try {
        return await handleRequest(request);
      } finally {
        // Clean up if queue empty
        // eslint-disable-next-line promise/always-return
        if (locks.get(id) === p) {
          // Our write has finished AND no others queued for this id
          locks.delete(id);
        }
      }
    });
  locks.set(id, p);

  return p;
});

/**
 * Data passed from request to response
 */
interface WriteContext extends KafkaBase {
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
  source?: string;
  rev?: number;
  /**
   * Wether the resource being written already exists
   */
  resourceExists?: boolean;
  /**
   * ID for fetching write body from DB
   */
  bodyid?: string;
  /**
   * Write body value (instead of fetching one from DB)
   */
  body?: unknown;
  /**
   * Wether to ignore any contained links in the write
   */
  ignoreLinks?: boolean;
  /**
   * Rev which must match current rev before write
   */
  "if-match"?: number[];
  /**
   * Revs which must not match current rev before write
   */
  "if-none-match"?: number[];
  // Change stuff?...
  /**
   * @todo what is this?
   */
  change_path?: string;
  /**
   * @todo what is this?
   */
  from_change_id?: string[];
}

/**
 * Response to a write request
 */
export interface WriteResponse extends KafkaBase, WriteContext {
  msgtype: "write-response";
  _rev: number;
  _orev?: number;
  change_id?: string;
}

async function checkPreconditions(request: WriteRequest) {
  if (request["if-match"]) {
    const rev = (await resources.getResource(
      request.resource_id,
      "/_rev",
    )) as unknown as number;
    if (!request["if-match"].includes(rev)) {
      throw new Error("if-match failed");
    }
  }

  if (request["if-none-match"]) {
    const rev = (await resources.getResource(
      request.resource_id,
      "/_rev",
    )) as unknown as number;
    if (request["if-none-match"].includes(rev)) {
      throw new Error("if-none-match failed");
    }
  }

  const rev =
    cache.get(request.resource_id) ??
    ((await resources.getResource(
      request.resource_id,
      "/_rev",
    )) as unknown as number);

  if (request.rev && rev !== request.rev) {
    throw new Error("rev mismatch");
  }

  return rev;
}

function mergeDeep<T extends Record<string, unknown>>(
  target: T,
  path: PathSegments,
  body: unknown,
) {
  if (path.length > 0) {
    const toMerge = {};
    JsonPointer.set(toMerge, path, body, true);
    return objectAssignDeep(target, toMerge);
  }

  return objectAssignDeep(target, body);
}

/**
 * @todo Better return type for this function
 */
async function doWrite(
  request: WriteRequest,
  body: unknown,
): Promise<{ id: string; rev?: number; orev?: number; changeId?: string }> {
  const isDelete = body === undefined;
  const changeType = isDelete ? "delete" : "merge";
  const id = request.resource_id.replace(/^\//, "");

  trace({ id, body }, "Writing body");
  const cacheRev = await checkPreconditions(request);

  let path = JsonPointer.decode(request.path_leftover);
  const method: typeof resources.putResource = isDelete
    ? async (pid, partial) =>
        resources.deletePartialResource(pid, [...path], partial)
    : resources.putResource;
  const object: DeepPartial<Resource> = {};

  // Perform delete
  if (isDelete) {
    trace("Body is undefined, doing delete");
    if (path.length > 0) {
      trace("Delete path = %s", path);
      // HACK: This is gross
      trace(
        "Setting method = deletePartialResource(%s, %o, %O)",
        id,
        path,
        object,
      );
      // eslint-disable-next-line unicorn/no-null
      body = null;
      trace(`Setting changeType = 'delete'`);
    } else {
      if (!request.resourceExists) {
        return { id, rev: undefined, orev: undefined, changeId: undefined };
      }

      trace("deleting resource altogether");
      const orev = await resources.deleteResource(id);
      return { id, orev };
    }
  }

  const ts = Date.now() / 1000;
  // FIXME: Sanitize keys?

  trace(
    "%s: Checking if resource exists (req.resourceExists = %s)",
    request.resource_id,
    request.resourceExists,
  );
  if (request.resourceExists === false) {
    trace(
      "initializing arango: resource_id = %s, path_leftover = %s",
      request.resource_id,
      request.path_leftover,
    );
    path = path.slice(2);

    // Initialize resource stuff
    objectAssignDeep(object, {
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
    trace({ resource: object }, "Intializing resource");
  }

  // Create object to recursively merge into the resource
  trace({ path }, "Recursively merging path into arango object");
  mergeDeep(object, path, body);
  trace({ body: object }, "Setting body on arango object");

  // Increment rev number
  let rev = Number.parseInt((cacheRev || 0) as string, 10) + 1;

  // If rev is supposed to be set to 1, this is a "new" resource.
  // However, change feed could still be around from an earlier delete,
  // so check that and set rev to more than biggest one
  if (rev === 1) {
    const changerev = await changes.getMaxChangeRev(id);
    if (changerev && changerev > 1) {
      rev = Number(changerev) + 1;
      trace(
        "Found old changes (max rev %d) for new resource, setting initial _rev to %d include them",
        changerev,
        rev,
      );
    }
  }

  // Update _meta
  metaPointers.modifiedBy.set(object, request.user_id, true);
  metaPointers.modified.set(object, ts, true);
  object._rev = rev;
  metaPointers.rev.set(object, rev, true);
  /**
   * ???: What should the order of precedence be?
   */
  const type = object?._type ?? object?._meta?._type;
  if (type) {
    object._type = type;
    metaPointers.type.set(object, type, true);
  }

  /**
   * ???: Error is body contains a non-matching `_id`
   */
  if ("_id" in object && object._id !== id) {
    const tError = new Error(
      `Tried to write _id ${object._id} to resource with _id ${id}`,
    );
    throw Object.assign(tError, { code: "bad request" });
  }

  // Compute new change
  const children = request.from_change_id ?? [];
  trace({ change: object }, "Putting change");
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
  metaPointers.changes.set(
    object,
    {
      _id: `${id}/_meta/_changes`,
      _rev: rev,
    },
    true,
  );

  const orev = await method(id, object, !request.ignoreLinks);
  return {
    id,
    rev,
    orev,
    changeId,
  };
}

export async function handleRequest(
  request: WriteRequest,
): Promise<WriteResponse> {
  request.source ??= "";
  // Fixes bug if this is undefined
  request.resourceExists ??= false;
  const oid = request.resource_id.replace(/^\//, "");

  try {
    // Get body and check permission in parallel
    info("Handling %s", oid);
    const body = request.bodyid
      ? await putBodies.getPutBody(request.bodyid)
      : request.body;

    trace('PUTing to "%s" in "%s"', request.path_leftover, oid);

    const { id, rev, orev, changeId } = await doWrite(request, body);

    if (rev) {
      // Put the new rev into the cache
      cache.put(id, rev);
    }

    const response: WriteResponse = {
      msgtype: "write-response",
      code: "success",
      resource_id: id,
      _rev: typeof rev === "number" ? rev : 0,
      _orev: orev,
      user_id: request.user_id,
      authorizationid: request.authorizationid,
      path_leftover: request.path_leftover,
      contentType: request.contentType,
      indexer: request.indexer,
      change_id: changeId,
    };
    // Causechain comes from rev-graph-update
    if (request.causechain) {
      // Pass through causechain if present
      response.causechain = request.causechain;
    }

    return response;
  } catch (cError: unknown) {
    const { code, message = "error" } =
      cError instanceof ArangoError &&
      (cError.errorNum as ArangoErrorCode) ===
        ArangoErrorCode.ARANGO_DOCUMENT_NOT_FOUND
        ? { ...cError, code: "not_found" }
        : (cError as {
            code?: string;
            message?: string;
          });
    // Send errors over kafka
    error({ request, error: cError }, message);

    return {
      msgtype: "write-response",
      code: code ?? message,
      error_message: message,
      user_id: request.user_id,
      authorizationid: request.authorizationid,
    } as WriteResponse;
  } finally {
    // Do cleanup
    if (request.bodyid) {
      await putBodies.removePutBody(request.bodyid);
    }
  }
}
