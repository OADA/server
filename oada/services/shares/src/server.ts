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

import { changes, users } from "@oada/lib-arangodb";
import type { KafkaBase } from "@oada/lib-kafka";
import { ReResponder } from "@oada/lib-kafka";

import type { WriteRequest, WriteResponse } from "@oada/write-handler";

import debug from "debug";

const error = debug("shares:error");
const trace = debug("shares:trace");

// ---------------------------------------------------------
// Kafka initializations:
const responder = new ReResponder({
  consumeTopic: config.get("kafka.topics.httpResponse"),
  produceTopic: config.get("kafka.topics.writeRequest"),
  group: "shares",
});

export async function stopResp(): Promise<void> {
  return responder.disconnect();
}

/**
 * Filter for successful write responses
 */
function checkRequest(request: KafkaBase): request is WriteResponse {
  return request?.msgtype === "write-response" && request?.code === "success";
}

responder.on<WriteRequest>("request", async function* (request) {
  if (!checkRequest(request)) {
    return;
  }

  // TODO: CHECK FOR OTHER ITERATIONS OF _meta/_permissions as it might occur in a request
  if (
    /_meta\/?$/.test(request.path_leftover) ||
    /_meta\/_permissions\/?/.test(request.path_leftover)
  ) {
    // Get user's /shares and add this
    const change = await changes.getChange(request.resource_id, request._rev);
    if (
      change?.type === "merge" &&
      typeof change.body?._meta === "object" &&
      change.body._meta &&
      "_permissions" in (change.body?._meta ?? {})
    ) {
      const { _permissions: permissions } = change.body._meta as {
        _permissions: Record<string, unknown>;
      };
      for await (const id of Object.keys(permissions)) {
        trace("Change made on user: %s", id);
        const user = await users.findById(id);
        if (!user) {
          error("Failed to find user by id %s", id);
          continue;
        }

        trace("making a write request to /shares for user - %s %s", id, user);
        yield {
          resource_id: user.shares._id,
          path_leftover: "",
          //						'meta_id': req['meta_id'],
          user_id: user.sub,
          //					 'authorizationid': req.user.doc['authorizationid'],
          //			     'client_id': req.user.doc['client_id'],
          contentType: "application/vnd.oada.permission.1+json",
          body: {
            [request.resource_id.replace(/^resources\//, "")]: {
              _id: request.resource_id,
            },
          },
        };
      }
    }
  }
});
