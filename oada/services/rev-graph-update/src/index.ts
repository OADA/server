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

import { resources } from "@oada/lib-arangodb";
import type { KafkaBase } from "@oada/lib-kafka";
import { Requester, Responder } from "@oada/lib-kafka";

// Import message format from write-handler
import type { WriteRequest, WriteResponse } from "@oada/write-handler";
import type { JTDSchemaType } from "ajv/dist/jtd.js";
import Ajv from "ajv/dist/jtd.js";
import debug from "debug";
import PQueue from "p-queue";
import type { SetRequired } from "type-fest";

const info = debug("rev-graph-update:info");
const warn = debug("rev-graph-update:warn");
const error = debug("rev-graph-update:error");

// ---------------------------------------------------------
// Batching
// adjust concurrency as needed
const requestPromises = new PQueue({ concurrency: 1 });
// This map is used as a queue of pending write requests
const requests = new Map<string, SetRequired<WriteRequest, "from_change_id">>();

// ---------------------------------------------------------
// Kafka initializations:
const responder = new Responder<WriteResponse>({
  consumeTopic: config.get("kafka.topics.httpResponse"),
  group: "rev-graph-update",
});
const requester = new Requester({
  consumeTopic: config.get("kafka.topics.httpResponse"),
  produceTopic: config.get("kafka.topics.writeRequest"),
  group: "rev-graph-update-batch",
});

export async function stopResp(): Promise<void> {
  return responder.disconnect();
}

/**
 * Check for successful write request
 */
function checkRequest(request: KafkaBase): request is WriteResponse {
  return request?.msgtype === "write-response" && request?.code === "success";
}

// Create custom parser and serializer for causechain.
// Should be faster than JSON methods and is slightly nicer in TypeScript.
// @ts-expect-error missing types
const ajv = new Ajv();
const causechainSchema: JTDSchemaType<string[]> = {
  elements: { type: "string" },
};
const parse = ajv.compileParser(causechainSchema) as ((
  s: string,
) => string[]) & { position: number; message: string };
const serialize = ajv.compileSerializer(causechainSchema) as (
  s: readonly string[],
) => string;

responder.on<WriteRequest>("request", async (request) => {
  if (!checkRequest(request)) {
    return; // Not a successful write-response message, ignore it
  }

  if (!request.resource_id || !Number.isInteger(request._rev)) {
    throw new Error(
      `Invalid http_response: keys resource_id or _rev are missing: ${JSON.stringify(
        request,
      )}`,
    );
  }

  if (request.user_id === undefined) {
    warn("Received message does not have user_id");
  }

  if (request.authorizationid === undefined) {
    warn("Received message does not have authorizationid");
  }

  // Real cycle detection: check the write-response's causechain
  // to see if the parent was already updated.
  // If so, no need to update it again, thus breaking the cycle.
  const causechain: string[] = [];
  if (request.causechain) {
    // In case req.causechain was an empty string
    const chain = parse(request.causechain);
    if (chain) {
      causechain.push(...chain);
    } else {
      error(
        "Error parsing req.causechain at %s: %s",
        parse.position,
        parse.message,
      );
    }
  }

  // Add this resource to the set of "causing" resources to prevent cycles
  causechain.push(request.resource_id);

  // Find resource's parents
  info("finding parents for resource_id = %s", request.resource_id);
  const parents = await resources.getParents(request.resource_id);
  for await (const parent of parents) {
    if (parent.resource_id === request.resource_id) {
      error("%s is its own parent!", request.resource_id);
      // Ignore this "parent"
      continue;
    }

    // Delete has null rev
    const childrev = typeof request._rev === "number" ? request._rev : 0;

    // Do not update parent if it was already the cause of a rev update
    // on this chain (prevent cycles)
    if (causechain.includes(parent.resource_id)) {
      info(
        "Parent %s exists in causechain, not scheduling for update",
        parent.resource_id,
      );
      continue;
    }

    const uniqueKey = `${parent.resource_id + parent.path}/_rev`;
    const qRequest = requests.get(uniqueKey);
    if (qRequest) {
      // Write request exists in the pending queue.
      // Add change ID to the request.
      info(
        "Resource %s already queued for changes, adding to queue",
        uniqueKey,
      );
      if (request.change_id) {
        qRequest.from_change_id.push(request.change_id);
      }

      qRequest.body = request._rev;
    } else {
      info(
        "Writing new child link rev (%d) to %s%s/_rev",
        childrev,
        parent.resource_id,
        parent.path,
      );
      // Create a new write request.
      const message = {
        // eslint-disable-next-line unicorn/no-null
        connection_id: null as unknown as string,
        type: "write_request",
        resource_id: parent.resource_id,
        // eslint-disable-next-line unicorn/no-null
        path: null,
        contentType: parent.contentType,
        body: childrev,
        url: "",
        user_id: "system/rev_graph_update",

        // This is an array; new change IDs may be added later
        from_change_id: request.change_id ? [request.change_id] : [],
        authorizationid: "authorizations/rev_graph_update",
        change_path: parent.path,
        path_leftover: `${parent.path}/_rev`,
        resourceExists: true,
        causechain: serialize(causechain),
      };

      // Add the request to the pending queue
      requests.set(uniqueKey, message);
      // TODO: What is up with the queue?
      // push
      void requestPromises.add(async () => {
        const messagePending = requests.get(uniqueKey);
        requests.delete(uniqueKey);
        return messagePending && requester.send(messagePending);
      });
    }
  }
});
