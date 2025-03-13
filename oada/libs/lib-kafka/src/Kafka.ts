/**
 * @license
 * Copyright 2022 Open Ag Data Alliance
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

import { config } from "./config.js";

import { Kafka, type KafkaConfig, type logLevel } from "kafkajs";
import debug from "debug";

/**
 * Make kafkajs logging nicer?
 */
type KafkajsDebug = Record<
  keyof Omit<typeof logLevel, "NOTHING">,
  debug.Debugger
>;
const kafkajsDebugs = new Map<string, KafkajsDebug>();
function getKafkajsDebug(namespace: string): KafkajsDebug {
  const d = kafkajsDebugs.get(namespace);
  if (d) {
    return d;
  }

  const newDebug = {
    ERROR: debug(`kafkajs:${namespace}:error`),
    WARN: debug(`kafkajs:${namespace}:warn`),
    INFO: debug(`kafkajs:${namespace}:info`),
    DEBUG: debug(`kafkajs:${namespace}:debug`),
  };
  kafkajsDebugs.set(namespace, newDebug);
  return newDebug;
}

/**
 * Wraps the `Kafka` client class to add our own defaults etc.
 * @see {@link Kafka}
 */
export default class IKafka extends Kafka {
  constructor({
    brokers = config.get("kafka.broker"),
    ...rest
  }: Partial<KafkaConfig> = {}) {
    super({
      ...rest,
      /**
       * Make kafkajs logging nicer?
       */
      logCreator() {
        return ({ namespace, label, log }) => {
          const l = label as keyof KafkajsDebug;

          const logger = getKafkajsDebug(namespace)[l];
          if (log instanceof Error) {
            logger({ err: log }, log.message);
          } else {
            const { message, ...extra } = log;
            logger(extra, message);
          }
        };
      },
      brokers,
    });
  }
}
