'use strict';

const config = require('./config');

const Requester = require('oada-lib-kafka').Requester;

// TODO: Is it better to have one requester per topic?
var kafkaReq = new Requester(
    config.get('kafka:topics:httpResponse'),
    null,
    'http-handlers'
);

module.exports = kafkaReq;
