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

'use strict';

const mock = require('mock-require');

const cbs = {};

before(function mockKafka() {
  mock('kafka-node', {
    Client: function MockClient() {},

    Producer: function MockProducer() {
      this.on = function (event, callback) {
        return event === 'ready' && setTimeout(callback);
      };

      this.createTopics = function (_topics, _foo, callback) {
        setTimeout(callback);
      };

      this.send = function mockSend(objs, callback) {
        for (const object of objs) {
          for (const message of [object.messages].flat()) {
            setTimeout(() => cbs[object.topic]({ value: message }));
          }
        }

        setTimeout(callback);
      };
    },

    ConsumerGroup: function MockConsumerGroup(_options, topics) {
      this.on = function (event, callback) {
        switch (event) {
          case 'message':
            for (const topic of topics) {
              cbs[topic] = callback;
            }

            break;
          case 'connect':
            setTimeout(callback);
            break;
          default:
        }
      };
    },

    Offset: function MockOffset() {
      this.commit = () => {};
    },
  });
});
