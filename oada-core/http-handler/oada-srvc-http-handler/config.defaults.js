'use strict';

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
        connectionString: 'http://arangodb:8529',
    },
    'http-handler': {websockets: {maxWatches: 100000}},
    kafka: {
        broker: 'zookeeper:2181',
        topics: {
            tokenRequest: 'token_request',
            graphRequest: 'graph_request',
            writeRequest: 'write_request',
            httpResponse: 'http_response'
        }
    },
    storage: {
        binary: {
            cacache: 'tmp/oada-cache'
        }
    }
};
