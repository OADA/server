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

// TODO: Publish this to npm instead?
import libConfig from "@oada/lib-config";

export const { config, schema } = await libConfig({
  kafka: {
    healthInterval: {
      format: "duration",
      default: 5 * 60 * 1000, // Ms
    },
    producer: {
      pollInterval: {
        format: "duration",
        default: 500, // Ms
      },
    },
    broker: {
      doc: "Kafka broker(s) to use",
      format: Array,
      default: ["kafka:9092"],
      env: "KAFKA_BROKERS",
      arg: "brokers",
    },
    timeouts: {
      doc: "Mapping of topic to timeouts (ms)",

      default: {
        default: 5000,
        writeRequest: 45_000,
        websocketsRequest: Number.POSITIVE_INFINITY,
      } as Record<string, number>,
    },
    topics: {
      doc: "Kafka topic names to use",

      default: {
        tokenRequest: "token_request",
        graphRequest: "graph_request",
        writeRequest: "write_request",
        websocketsRequest: "websockets_request",
        permissionsRequest: "permissions_request",
        permissionsResponse: "permissions_response",
        httpResponse: "http_response",
      } as Record<string, string>,
    },
  },
});
