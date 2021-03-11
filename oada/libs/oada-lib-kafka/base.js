/* Copyright 2017 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const process = require('process');
const EventEmitter = require('events');

const Bluebird = require('bluebird');
const ksuid = require('ksuid');
const kf = require('node-rdkafka');

const config = require('./config');
const info = require('debug')('@oada/lib-kafka:info');
const error = require('debug')('@oada/lib-kafka:error');

const REQ_ID_KEY = 'connection_id';
const CANCEL_KEY = 'cancel_request';
// Not sure I like the way options are oragnised, but it works
const rdkafkaOpts = Object.assign(config.get('kafka:librdkafka'), {
    'metadata.broker.list': config.get('kafka:broker'),
});

const CONNECT = Symbol('kafka-lib-connect');
const DATA = Symbol('kafa-lib-data');

const pollInterval = 500;
const healthInterval = 5 * 60 * 1000;

function topicTimeout(topic) {
    let timeout = config.get('kafka:timeouts:default');

    let topics = config.get('kafka:topics');
    Object.keys(topics).forEach((topick) => {
        if (topics[topick] === topic) {
            timeout = config.get('kafka:timeouts:' + topick) || timeout;
        }
    });

    return timeout;
}

// Make it die on unhandled error
// TODO: Figure out what is keeping node from dying on unhandled exception?
function die(err) {
    error('Unhandled error: %O', err);
    process.abort();
}

class Base extends EventEmitter {
    constructor({ consumeTopic, consumer, produceTopic, producer, group }) {
        super();

        this.consumeTopic = consumeTopic;
        this.produceTopic = produceTopic;
        this.group = group;

        this.requests = {};

        this.consumer =
            consumer ||
            new kf.KafkaConsumer({
                'group.id': this.group,
                ...rdkafkaOpts,
            });
        this.producer =
            producer ||
            new kf.Producer({
                dr_cb: false, //delivery report callback
                ...rdkafkaOpts,
            });

        this.consumer.on('error', (...args) => super.emit('error', ...args));
        this.producer.on('error', (...args) => super.emit('error', ...args));
        this.producer.on('delivery-report', function (err, _report) {
            if (err) error('!!!!!!!!!!!!!!!!!!!!!!! %O', err);
        });

        this.consumer.on('event.error', (...args) =>
            super.emit('error', ...args)
        );
        this.producer.on('event.error', (...args) =>
            super.emit('error', ...args)
        );

        const consumerReady = Bluebird.fromCallback((done) => {
            this.consumer.on('ready', () => {
                info(`${this.group}'s consumer ready`);
                done();
            });
        });
        const producerReady = Bluebird.fromCallback((done) => {
            this.producer.on('ready', () => {
                this.producer.setPollInterval(
                    config.get('kafka:producer:pollInterval') || pollInterval
                );
                info(`${this.group}'s producer ready`);
                // Health loop to keep the broker alive.
                setInterval(() => {
                    var value = Buffer.from(produceTopic + 'is alive.');
                    //TODO: other health messages here
                    this.producer.produce(
                        'health',
                        0,
                        value,
                        ksuid.randomSync().string
                    );
                }, config.get('kafka:producer:healthIterval') || healthInterval);
                done();
            });
        });
        this.ready = Bluebird.join(consumerReady, producerReady);

        // Error handling stuff?
        super.on('error', die);
        // see: https://github.com/Blizzard/node-rdkafka/issues/222
        // says fixed, but seems to still be an issue for us.
        process.on('uncaughtExceptionMonitor', () => {
            error('Disconnect kafka clients due to uncaught exception');
            // Disconnect kafka clients on uncaught exception
            try {
                this.consumer.disconnect();
            } catch (err) {
                error(err);
            }
            try {
                this.producer.disconnect();
            } catch (err) {
                error(err);
            }
        });
    }

    on(event, listener) {
        if (event === 'error') {
            // Remove our default error handler?
            super.removeListener('error', die);
        }
        super.on(event, listener);
    }

    async [CONNECT]() {
        // Assume all messages are JSON
        this.consumer.on('data', ({ value, ...data }) => {
            const resp = JSON.parse(value);
            super.emit(DATA, resp, data);
        });

        this.consumer.connect();
        this.producer.connect();
        await this.ready;

        const topics = Array.isArray(this.consumeTopic)
            ? this.consumeTopic
            : [this.consumeTopic];
        this.consumer.subscribe(topics);
        this.consumer.consume();

        super.emit('ready');
    }

    async produce({ mesg, topic, part = null }) {
        // Assume all messages are JSON
        const payload = JSON.stringify({
            time: Date.now(),
            group: this.group,
            ...mesg,
        });
        const value = Buffer.from(payload);

        await this.ready;

        return this.producer.produce(topic || this.produceTopic, part, value);
    }

    disconnect() {
        const dcons = Bluebird.fromCallback((done) => {
            this.consumer.disconnect(() => done());
        });
        const dprod = Bluebird.fromCallback((done) => {
            this.producer.disconnect(() => done());
        });

        return Bluebird.join(dcons, dprod);
    }
}

module.exports = {
    REQ_ID_KEY,
    CANCEL_KEY,
    Base,
    topicTimeout,
    CONNECT,
    DATA,
};
