'use strict';

module.exports = {
  kafka: {
    broker: 'kafka:9092',
    topics: {
      writeRequest: 'write_request',
      httpResponse: 'http_response',
    },
  },
};
