'use strict';

const Promise = require('bluebird');
const kf = require('node-rdkafka');
const config = require('./config');
const uuid = require('uuid');
const info = require('debug')('oada-lib-kafka:info');
const warn = require('debug')('oada-lib-kafka:warn');

const REQ_ID_KEY = 'connection_id';

function topicTimeout(topic) {
    let timeout = config.get('kafka:timeouts:default');

    let topics = config.get('kafka:topics');
    Object.keys(topics).forEach(topick => {
        if (topics[topick] === topic) {
            timeout = config.get('kafka:timeouts:' + topick) || timeout;
        }
    });

    return timeout;
}

function Responder(listenTopic, respTopic, groupId, opts) {
    this.listenTopic = listenTopic;
    this.respTopic = respTopic;

    this.opts = opts || {};

    this.consumer = new kf.KafkaConsumer({
        // 'debug': config.get('debug'),
        'metadata.broker.list': config.get('kafka:broker'),
        'group.id': groupId,
        'enable.auto.commit': config.get('kafka:auto_commit'),
        'auto.offset.reset': config.get('kafka:auto_offset_reset')
    });
    this.producer = new kf.Producer({
        // 'debug': config.get('debug'),
        'metadata.broker.list': config.get('kafka:broker'),
        'dr_cb': true  //delivery report callback
    });

    let consumerReady = Promise.fromCallback(done => {
            this.consumer.on('ready', () => {
                info('Responder\'s consumer ready');
                done();
            });
        })
        .then(() => {
            this.consumer.subscribe([listenTopic]);
            this.consumer.consume();
        });
    let producerReady = Promise.fromCallback(done => {
        this.producer.on('ready', () => {
            info('Responder\'s producer ready');
            done();
        });
    });
    this.ready = Promise.join(consumerReady, producerReady);
    this.consumer.connect();
    this.producer.connect();

    this.timeout = topicTimeout(this.listenTopic);
}

Responder.prototype.disconnect = function disconnect() {
    let dcons = Promise.fromCallback(done=> {
        this.consumer.disconnect(() => done());
    });
    let dprod = Promise.fromCallback(done => {
        this.producer.disconnect(() => done());
    });

    return Promise.join(dcons, dprod);
};

Responder.prototype.on = function on(event, callback) {
    switch (event) {
        case 'request':
            this.consumer.on('data', (data) => {
                let req = JSON.parse(data.value);
                delete data.value;
                let id = req[REQ_ID_KEY];
                let part = req['resp_partition'];
                if (typeof part !== 'number') {
                    part = null;
                }
                info(`Received request ${id}`);

                // Check for old messages
                if (!this.opts.old && (Date.now() - req.time) >= this.timeout) {
                    warn('Ignoring timed-out request');
                    return;
                }

                let resp = callback(req, data);
                this.ready.return(resp)
                    .then(resp => {
                        if (!Array.isArray(resp)) {
                            return resp === undefined ? [] : [resp];
                        }
                        return resp;
                    })
                    .map(resp => {
                        resp[REQ_ID_KEY] = id;
                        resp['time'] = Date.now();
                        let payload = JSON.stringify(resp);
                        let value = new Buffer(payload);
                        this.producer.produce(this.respTopic, part, value);
                    })
                    .finally(() => {
                        // TODO: Handle committing better
                        //this.consumer.commit(data);
                    });
            });
            break;
        case 'ready':
            this.ready.then(callback);
            break;
        case 'error':
            this.consumer.on('error', callback);
            this.producer.on('error', callback);
            this.consumer.on('event.error', callback);
            this.producer.on('event.error', callback);
            break;
        default:
            warn('oada-lib-kafka: unsupported event');
            break;
    }
};

function Requester(listenTopic, respTopic, groupId) {
    this.listenTopic = listenTopic;
    this.respTopic = respTopic;
    this.consumer = new kf.KafkaConsumer({
        'debug': config.get('debug'),
        'metadata.broker.list': config.get('kafka:broker'),
        'group.id': groupId,
        'enable.auto.commit': config.get('kafka:auto_commit'),
        'auto.offset.reset': config.get('kafka:auto_offset_reset')
    });
    this.producer = new kf.Producer({
        'debug': config.get('debug'),
        'metadata.broker.list': config.get('kafka:broker'),
        'dr_cb': true  //delivery report callback
    });
    let consumerReady = Promise.fromCallback(done => {
            this.consumer.on('ready', () => {
                info('Requester\'s consumer ready');
                done();
            });
        })
        .then(() => {
            this.consumer.subscribe([listenTopic]);
            this.consumer.consume();
        });
    let producerReady = Promise.fromCallback(done => {
        this.producer.on('ready', () => {
            info('Requester\'s producer ready');
            done();
        });
    });
    this.ready = Promise.join(consumerReady, producerReady);
    this.consumer.connect();
    this.producer.connect();

    this.requests = {};
    this.consumer.on('data', msg => {
        let resp = JSON.parse(msg.value);

        let done = this.requests[resp[REQ_ID_KEY]];

        return done && done(null, resp);
    });

    this.timeouts = {};
    if (this.respTopic) {
        this.timeouts[this.respTopic] = topicTimeout(this.respTopic);
    }
}

Requester.prototype.disconnect = function disconnect() {
    let dcons = Promise.fromCallback(done=> {
        this.consumer.disconnect(() => done());
    });
    let dprod = Promise.fromCallback(done => {
        this.producer.disconnect(() => done());
    });

    return Promise.join(dcons, dprod);
};

Requester.prototype.on = function on(event, callback) {
    switch (event) {
        case 'response':
            this.consumer.on('data', (data) => {
                let resp = callback(JSON.parse(data.value));
                this.ready.return(resp)
                .finally(() => {
                    //this.consumer.commit(data);
                });
            });
            break;
        case 'ready':
            this.ready.then(callback);
            break;
        default:
            warn('oada-lib-kafka: unsupported event');
            break;
    }
};

Requester.prototype.send = function send(request, topic) {
    let id = request[REQ_ID_KEY] || uuid();
    topic = topic || this.respTopic;
    let timeout = this.timeouts[topic];
    if (!timeout) {
        timeout = topicTimeout(topic);
        this.timeouts[topic] = timeout;
    }

    request[REQ_ID_KEY] = id;
    request['time'] = Date.now();
    // TODO: Handle partitions?
    request['resp_partition'] = 0;

    let reqDone = Promise.fromCallback(done => {
        this.requests[id] = done;
    });
    return this.ready
        .then(() => {
            let payload = JSON.stringify(request);
            let value = new Buffer(payload);
            this.producer.produce(topic, null, value);
        })
        .then(() => {
            return reqDone.timeout(timeout, topic + ' timeout');
        })
        .finally(() => {
            delete this.requests[id];
        });
};

module.exports = {
    Responder,
    Requester
};
