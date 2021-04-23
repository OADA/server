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

const process = require('process');
const EventEmitter = require('events');

const Bluebird = require('bluebird');
const { Kafka } = require('kafkajs');

const config = require('./config');
const info = require('debug')('@oada/lib-kafka:info');
const error = require('debug')('@oada/lib-kafka:error');

const REQ_ID_KEY = 'connection_id';
const CANCEL_KEY = 'cancel_request';

const CONNECT = Symbol('kafka-lib-connect');
const DATA = Symbol('kafa-lib-data');

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

        this.kafka = new Kafka({
            brokers: config.get('kafka:broker').split(','),
        });

        this.consumer =
            consumer ||
            this.kafka.consumer({
                groupId: this.group,
            });
        this.producer = producer || this.kafka.producer();

        // see: https://github.com/Blizzard/node-rdkafka/issues/222
        // says fixed, but seems to still be an issue for us.
        process.on('uncaughtExceptionMonitor', async () => {
            error('Disconnect kafka clients due to uncaught exception');
            // Disconnect kafka clients on uncaught exception
            try {
                await this.consumer.disconnect();
            } catch (err) {
                error(err);
            }
            try {
                await this.producer.disconnect();
            } catch (err) {
                error(err);
            }
        });

        this.ready = Bluebird.fromCallback((done) => {
            this[CONNECT] = async () => {
                try {
                    await this.consumer.connect();
                    await this.producer.connect();

                    this.consumer.subscribe({ topic: this.consumeTopic });
                    this.consumer.run({
                        eachMessage: async ({
                            message: { value, ...data },
                        }) => {
                            // Assume all messages are JSON
                            const resp = JSON.parse(value);
                            super.emit(DATA, resp, data);
                        },
                    });
                } catch (err) {
                    return done(err);
                }
                done();
            };
        });
    }

    on(event, listener) {
        if (event === 'error') {
            // Remove our default error handler?
            super.removeListener('error', die);
        }
        super.on(event, listener);
    }

    async produce({ mesg, topic, part = null }) {
        // Assume all messages are JSON
        const value = JSON.stringify({
            time: Date.now(),
            group: this.group,
            ...mesg,
        });

        return this.producer.send({
            topic: topic || this.produceTopic,
            messages: [{ value }],
        });
    }

    async disconnect() {
        await this.consumer.disconnect();
        await this.producer.disconnect();
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
