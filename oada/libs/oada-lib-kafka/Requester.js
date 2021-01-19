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

'use strict'

const EventEmitter = require('events')
const util = require('util')
const ksuid = require('ksuid')
const Bluebird = require('bluebird')

const info = require('debug')('@oada/lib-kafka:info')
const warn = require('debug')('@oada/lib-kafka:warn')

const {
    Base,
    topicTimeout,
    CONNECT,
    DATA,
    REQ_ID_KEY,
    CANCEL_KEY
} = require('./base')

module.exports = class Requester extends Base {
    constructor ({ consumeTopic, produceTopic, group, ...opts }) {
        // Gross thing to support old API
        if (arguments.length > 1) {
            // eslint-disable-next-line no-param-reassign, prefer-rest-params
            ;[consumeTopic, produceTopic, group] = arguments

            // Print deprecation warning
            util.deprecate(() => {},
            'Giving multiple arguments to constructor is deprecated')()
        }
        super({ consumeTopic, produceTopic, group, ...opts })

        super.on(DATA, resp => {
            let done = this.requests[resp[REQ_ID_KEY]]

            return done && done(null, resp)
        })

        this.timeouts = {}
        if (this.produceTopic) {
            this.timeouts[this.produceTopic] = topicTimeout(this.produceTopic)
        }

        this[CONNECT]()

        // Should this even be available?
        super.on(DATA, (...args) => super.emit('response', ...args))
    }

    send (request, reqtopic) {
        let id = request[REQ_ID_KEY] || ksuid.randomSync().string
        let topic = reqtopic || this.produceTopic
        let timeout = this.timeouts[topic]
        if (!timeout) {
            timeout = topicTimeout(topic)
            this.timeouts[topic] = timeout
        }

        request[REQ_ID_KEY] = id
        // TODO: Handle partitions?
        request['resp_partition'] = 0

        let reqDone = Bluebird.fromCallback(done => {
            this.requests[id] = done
        })
        let prod = this.produce({ mesg: request, topic, part: null })
        return Bluebird.resolve(prod)
            .then(() => reqDone.timeout(timeout, topic + ' timeout'))
            .finally(() => {
                delete this.requests[id]
            })
    }

    // Like send but return an event emitter to allow multiple responses
    emitter (request, reqtopic) {
        let emitter = new EventEmitter()

        let id = request[REQ_ID_KEY] || ksuid.randomSync().string
        let topic = reqtopic || this.produceTopic

        request[REQ_ID_KEY] = id
        // TODO: Handle partitions?
        request['resp_partition'] = 0

        this.request[id] = (e, res) => emitter.emit('response', res)
        emitter.close = () =>
            Bluebird.try(() => {
                // Send cancel message to other end
                let mesg = {
                    [REQ_ID_KEY]: id,
                    [CANCEL_KEY]: true
                }

                this.produce({ mesg, topic, part: null })
                delete this.request[id]
            })

        return this.produce({ mesg: request, topic, part: null }).return(
            emitter
        )
    }
}
