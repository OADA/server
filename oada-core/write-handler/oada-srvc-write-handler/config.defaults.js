'use strict'

module.exports = {
  kafka: {
    broker: 'zookeeper:2181',
    topics: {
      writeRequest: 'write_request',
      httpResponse: 'http_response'
    }
  }
}
