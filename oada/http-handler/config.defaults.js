'use strict'

module.exports = {
    server: {
        port: 80,
        mode: 'http',
        domain: 'localhost', // in docker it's port 80 localhost
        publicUri: 'https://localhost' // but to nginx proxy, it's https://localhost in dev
    },
    // Prefix should match nginx proxy's prefix for the auth service
    //endpointsPrefix: '/oadaauth',
    arango: {
        connectionString: 'http://arangodb:8529'
    },
    'http-handler': { websockets: { maxWatches: 100000 } },
    kafka: {
        healthInterval: 5 * 60 * 1000, // ms
        producer: {
            pollInterval: 500 // ms
        },
        broker: 'kafka',
        // https://github.com/edenhill/librdkafka/blob/master/CONFIGURATION.md
        librdkafka: {
            'enable.auto.commit': false,
            'auto.offset.reset': 'latest',
            // Needed to lower latency
            'fetch.wait.max.ms': 10,
            'fetch.error.backoff.ms': 10,
            //'fetch.min.bytes': 1,
            'request.required.acks': 0,
            'socket.blocking.max.ms': 10,
            'queue.buffering.max.ms': 5
        },
        timeouts: {
            default: 5000,
            writeRequest: 45000,
            websocketsRequest: Infinity
        },
        topics: {
            tokenRequest: 'token_request',
            graphRequest: 'graph_request',
            writeRequest: 'write_request',
            websocketsRequest: 'websockets_request',
            permissionsRequest: 'permissions_request',
            permissionsResponse: 'permissions_response',
            httpResponse: 'http_response'
        }
    },
    storage: {
        binary: {
            cacache: 'tmp/oada-cache'
        }
    }
}
