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

const info = require('debug')('oada-lib-kafka:info');
const warn = require('debug')('oada-lib-kafka:warn');

const {
    Base,
    CONNECT,
    DATA,
} = require('./base');
const Responder = require('./Responder');
const Requester = require('./Requester');

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

module.exports = ResponderRequester;
