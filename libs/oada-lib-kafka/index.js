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

const CONNECT = Symbol('kafka-lib-connect');
const DATA = Symbol('kafa-lib-data');

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

const EMITTER = Symbol('kafa-lib-emitter'); // Don't touch my emitter plebs
class Base {
    constructor({consumeTopic, consumer, produceTopic, producer, group}) {
        this.consumeTopic = consumeTopic;
        this.produceTopic = produceTopic;
        this.group = group;

        this[EMITTER] = new EventEmitter();

        this.requests = {};

        this.consumer = consumer || new kf.KafkaConsumer({
            'group.id': this.group,
            ...rdkafkaOpts
        });
        this.producer = producer || new kf.Producer({
            'dr_cb': true, //delivery report callback
            ...rdkafkaOpts
        });

        this.consumer.on('error', (...args) =>
            this[EMITTER].emit('error', ...args)
        );
        this.producer.on('error', (...args) =>
            this[EMITTER].emit('error', ...args)
        );
        this.consumer.on('event.error', (...args) =>
            this[EMITTER].emit('error', ...args)
        );
        this.producer.on('event.error', (...args) =>
            this[EMITTER].emit('error', ...args)
        );

        let consumerReady = Promise.fromCallback(done => {
            this.consumer.on('ready', () => {
                info(`${this.group}'s consumer ready`);
                done();
            });
        });
        let producerReady = Promise.fromCallback(done => {
            this.producer.on('ready', () => {
                info(`${this.group}'s producer ready`);
                done();
            });
        });
        this.ready = Promise.join(consumerReady, producerReady);
    }

    on(event, listener) {
        return this[EMITTER].on(event, listener);
    }

    once(event, listener) {
        return this[EMITTER].once(event, listener);
    }

    async [CONNECT]() {
        // Assume all messages are JSON
        this.consumer.on('data', ({value, ...data}) => {
            let resp = JSON.parse(value);
            this[EMITTER].emit(DATA, resp, data);
        });

        this.consumer.connect();
        this.producer.connect();
        await this.ready;

        let topics = Array.isArray(this.consumeTopic) ?
            this.consumeTopic : [this.consumeTopic];
        this.consumer.subscribe(topics);
        this.consumer.consume();

        this[EMITTER].emit('ready');
    }

    disconnect() {
        let dcons = Promise.fromCallback(done => {
            this.consumer.disconnect(() => done());
        });
        let dprod = Promise.fromCallback(done => {
            this.producer.disconnect(() => done());
        });

        return Promise.join(dcons, dprod);
    }
}

class Responder extends Base {
    constructor({consumeTopic, produceTopic, group, ...opts}) {
        // Gross thing to support old API
        if (arguments.length > 1) {
            // eslint-disable-next-line no-param-reassign, prefer-rest-params
            [consumeTopic, produceTopic, group, opts] = arguments;
        }
        super({consumeTopic, produceTopic, group, ...opts});

        this.opts = opts || {};
        this.requests = {};

        this.timeout = topicTimeout(this.consumeTopic);

        this[CONNECT]();
    }

    on(event, listener) {
        if (event === 'request') {
            // TODO: Probably a better way to hande this event...
            return super.on(DATA, (req, data) => {
                let id = req[REQ_ID_KEY];
                let part = req['resp_partition'];
                if (typeof part !== 'number') {
                    part = null;
                }
                let domain = req.domain;
                info(`Received request ${id}`);

                // Check for old messages
                if (!this.opts.old && Date.now() - req.time >= this.timeout) {
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
                if (listener.length === 3) {
                    this.ready.then(() => listener(req, data, respond));
                } else {
                    let resp = listener(req, data);
                    this.ready.return(resp).then(resp => {
                        // Check for generator
                        if (typeof (resp && resp.next) === 'function') {
                            // Keep track of generator to later close it
                            this.requests[id] = resp;

                            // Asynchronously use generator
                            let self = this;
                            (function generate(gen) {
                                let resp = gen.next();

                                if (resp.done) {
                                    delete self.requests[id];
                                } else {
                                    respond(resp.value).return(gen)
                                        .then(generate);
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
                        .then(resp => {
                            if (!Array.isArray(resp)) {
                                return resp === undefined ? [] : [resp];
                            }
                            return resp;
                        })
                        .each(resp => {
                            if (resp[REQ_ID_KEY] === null) {
                                resp[REQ_ID_KEY] = uuid();
                            } else {
                                resp[REQ_ID_KEY] = id;
                                // Check for cancelled requests
                                if (!self.requests[id]) {
                                    throw new Error('Request cancelled');
                                }
                            }
                            resp['time'] = Date.now();
                            resp.domain = domain;
                            let payload = JSON.stringify(resp);
                            let value = Buffer.from(payload);
                            self.producer
                                .produce(self.produceTopic, part, value);
                        })
                        .finally(() => {
                            // TODO: Handle committing better
                            //this.consumer.commit(data);
                        });
                }
            });
        } else {
            return super.on(event, listener);
        }
    }
}

class Requester extends Base {
    constructor({consumeTopic, produceTopic, group, ...opts}) {
        // Gross thing to support old API
        if (arguments.length > 1) {
            // eslint-disable-next-line no-param-reassign, prefer-rest-params
            [consumeTopic, produceTopic, group] = arguments;
        }
        super({consumeTopic, produceTopic, group, ...opts});

        super.on(DATA, resp => {
            let done = this.requests[resp[REQ_ID_KEY]];

            return done && done(null, resp);
        });

        this.timeouts = {};
        if (this.produceTopic) {
            this.timeouts[this.produceTopic] = topicTimeout(this.produceTopic);
        }

        this[CONNECT]();

        // Should this even be available?
        super.on(DATA, (...args) =>
            this[EMITTER].emit('response', ...args)
        );
    }

    send(request, reqtopic) {
        let id = request[REQ_ID_KEY] || uuid();
        let topic = reqtopic || this.produceTopic;
        let timeout = this.timeouts[topic];
        if (!timeout) {
            timeout = topicTimeout(topic);
            this.timeouts[topic] = timeout;
        }

        request[REQ_ID_KEY] = id;
        request['time'] = Date.now();
        request['group'] = this.group;
        // TODO: Handle partitions?
        request['resp_partition'] = 0;

        let reqDone = Promise.fromCallback(done => {
            this.requests[id] = done;
        });
        return this.ready
            .then(() => {
                let payload = JSON.stringify(request);
                let value = Buffer.from(payload);
                this.producer.produce(topic, null, value);
            })
            .then(() => reqDone.timeout(timeout, topic + ' timeout'))
            .finally(() => {
                delete this.requests[id];
            });
    }

    // Like send but return an event emitter to allow multiple responses
    emitter(request, reqtopic) {
        let emitter = new EventEmitter();

        let id = request[REQ_ID_KEY] || uuid();
        let topic = reqtopic || this.produceTopic;

        request[REQ_ID_KEY] = id;
        request['time'] = Date.now();
        request['group'] = this.group;
        // TODO: Handle partitions?
        request['resp_partition'] = 0;

        this.request[id] = (e, res) => emitter.emit('response', res);
        emitter.close = () => Promise.try(() => {
            let payload = JSON.stringify({
                [REQ_ID_KEY]: id,
                [CANCEL_KEY]: true
            });
            let value = Buffer.from(payload);
            this.producer.produce(topic, null, value);

            delete this.request[id];
        });

        return this.ready
            .then(() => {
                let payload = JSON.stringify(request);
                let value = Buffer.from(payload);
                this.producer.produce(topic, null, value);
            })
            .return(emitter);
    }
}

class DummyResponder extends Responder {
    [CONNECT]() { // eslint-disable-line class-methods-use-this
        // Don't connect to Kafka
        return undefined;
    }
}
class DummyRequester extends Requester {
    [CONNECT]() { // eslint-disable-line class-methods-use-this
        // Don't connect to Kafka
        return undefined;
    }
}
// Class for when responding to reuqests requires making other requests
// TODO: Better class name?
class ResponderRequester extends Base {
    constructor({requestTopics, respondTopics, group, ...opts}) {
        super({
            consumeTopic: [
                requestTopics.consumeTopic,
                respondTopics.consumeTopic
            ],
            group,
            ...opts
        });

        // Make a Responder and Requester using our consumer/producer
        this.responder = new DummyResponder({
            consumer: this.consumer,
            producer: this.producer,
            group,
            ...respondTopics,
            ...opts,
        });
        this.requester = new DummyRequester({
            consumer: this.consumer,
            producer: this.producer,
            group,
            ...requestTopics,
            ...opts,
        });

        this[CONNECT]();
    }

    on(event, val, ...args) {
        switch (event) {
        case 'ready':
            super.on('ready', val, ...args);
            break;
        case DATA: // Mux the consumer between requester and responder
            if (val.topic === this.requester.consumeTopic) {
                this.requester.on(DATA, val, ...args);
            }
            if (val.topic === this.responder.consumeTopic) {
                if (!this.opts.respondOwn && val.group === this.group) {
                    // Don't respond to own requests
                    break;
                }
                this.responder.on(DATA, val, ...args);
            }
            break;
        default:
            this.requester.on(event, val, ...args);
            this.responder.on(event, val, ...args);
            break;
        }
    }

    // TODO: Is it better to just extend Requester?
    send(...args) {
        return this.requester.send(...args);
    }
    emitter(...args) {
        return this.requester.emitter(...args);
    }
}

module.exports = {
    Responder,
    Requester,
    ResponderRequester,
};
