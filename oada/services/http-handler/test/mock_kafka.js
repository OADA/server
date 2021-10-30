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
