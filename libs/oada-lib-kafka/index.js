'use strict';

const EventEmitter = require('events');
var Promise = require('bluebird');
const kf = require('node-rdkafka');
const config = require('./config');
const uuid = require('uuid');
const info = require('debug')('oada-lib-kafka:info');
const warn = require('debug')('oada-lib-kafka:warn');

const REQ_ID_KEY = 'connection_id';
const CANCEL_KEY = 'cancel_request';
// Not sure I like the way options are oragnised, but it works
const rdkafkaOpts = Object.assign(config.get('kafka:librdkafka'), {
    'metadata.broker.list': config.get('kafka:broker'),
});

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

    this.consumer = new kf.KafkaConsumer(Object.assign({
        'group.id': groupId,
    }, rdkafkaOpts));
    this.producer = new kf.Producer(Object.assign({
        'dr_cb': true,  //delivery report callback
    }, rdkafkaOpts));

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
    this.ready = Promise.join(consumerReady, producerReady).bind(this);
    this.consumer.connect();
    this.producer.connect();

    this.requests = {};

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
                let domain = req.domain;
                info(`Received request ${id}`);

                // Check for old messages
                if (!this.opts.old && (Date.now() - req.time) >= this.timeout) {
                    warn('Ignoring timed-out request');
                    return;
                }

                // Check for cancelling request
                if (req[CANCEL_KEY]) {
                    let gen = this.requests[id];
                    delete this.requests[id];

                    if (typeof (gen && gen.return) === 'function') {
                        // Stop generator
                        gen.return();
                    }

                    return;
                }

                this.requests[id] = true;
                if (callback.length === 3) {
                    this.ready.then(() => callback(req, data, respond));
                } else {
                    let resp = callback(req, data);
                    this.ready.return(resp).then(resp => {
                        // Check for generator
                        if (typeof (resp && resp.next) === 'function') {
                            // Keep track of generator to later close it
                            this.requests[id] = resp;

                            // Asynchronously use generator
                            let self = this;
                            (function generate(gen) {
                                let resp = gen.next();

                                if (!resp.done) {
                                    respond(resp.value).return(gen)
                                        .then(generate);
                                } else {
                                    delete self.requests[id];
                                }
                            })(resp);
                        } else {
                            respond(resp).then(() => delete this.requests[id]);
                        }
                    });
                }

                let self = this;
                function respond(resp) {
                    return Promise.resolve(resp)
                        .tap(function checkNotCancelled() {
                            if (!self.requests[id]) {
                                let err = new Error('Request cancelled');
                                return Promise.reject(err);
                            }
                        })
                        .then(resp => {
                            if (!Array.isArray(resp)) {
                                return resp === undefined ? [] : [resp];
                            }
                            return resp;
                        })
                        .map(resp => {
                            if (resp[REQ_ID_KEY] === null) {
                                resp[REQ_ID_KEY] = uuid();
                            } else {
                                resp[REQ_ID_KEY] = id;
                            }
                            resp['time'] = Date.now();
                            resp.domain = domain;
                            let payload = JSON.stringify(resp);
                            let value = new Buffer(payload);
                            self.producer.produce(self.respTopic, part, value);
                        })
                        .finally(() => {
                            // TODO: Handle committing better
                            //this.consumer.commit(data);
                        });
                }
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
    this.consumer = new kf.KafkaConsumer(Object.assign({
        'group.id': groupId,
    }, rdkafkaOpts));
    this.producer = new kf.Producer(Object.assign({
        'dr_cb': true,  //delivery report callback
    }, rdkafkaOpts));
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

// Like send but return an event emitter to allow multiple responses
Requester.prototype.emitter = function emitter(request, topic) {
    let emitter = new EventEmitter();

    let id = request[REQ_ID_KEY] || uuid();
    topic = topic || this.respTopic;

    request[REQ_ID_KEY] = id;
    request['time'] = Date.now();
    // TODO: Handle partitions?
    request['resp_partition'] = 0;

    this.request[id] = (err, res) => emitter.emit('response', res);
    emitter.close = () => {
        return Promise.try(() => {
            let payload = JSON.stringify({
                [REQ_ID_KEY]: id,
                [CANCEL_KEY]: true
            });
            let value = new Buffer(payload);
            this.producer.produce(topic, null, value);

            delete this.request[id];
        });
    };

    return this.ready
        .then(() => {
            let payload = JSON.stringify(request);
            let value = new Buffer(payload);
            this.producer.produce(topic, null, value);
        })
        .return(emitter);
};

module.exports = {
    Responder,
    Requester
};
