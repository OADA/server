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

const util = require('util')
const uuid = require('uuid')
const Bluebird = require('bluebird')

const trace = require('debug')('oada-lib-kafka:trace')
const info = require('debug')('oada-lib-kafka:info')
const warn = require('debug')('oada-lib-kafka:warn')

const {
    Base,
    topicTimeout,
    CONNECT,
    DATA,
    REQ_ID_KEY,
    CANCEL_KEY
} = require('./base')

module.exports = class Responder extends Base {
    constructor ({ consumeTopic, produceTopic, group, ...opts }) {
        // Gross thing to support old API
        if (arguments.length > 1) {
            // eslint-disable-next-line no-param-reassign, prefer-rest-params
            ;[consumeTopic, produceTopic, group, opts] = arguments

            // Print deprecation warning
            util.deprecate(() => {},
            'Giving multiple arguments to constructor is deprecated')()
        }
        super({ consumeTopic, produceTopic, group, ...opts })

        this.opts = opts || {}
        this.requests = {}

        this.timeout = topicTimeout(this.consumeTopic)

        this[CONNECT]()
    }

    on (event, listener) {
        if (event === 'request') {
            // TODO: Probably a better way to hande this event...
            return super.on(DATA, (req, data) => {
                let id = req[REQ_ID_KEY]
                let part = req['resp_partition']
                if (typeof part !== 'number') {
                    part = null
                }
                let domain = req.domain
                let group = req.group
                trace(`Received request ${id}`)

                // Check for old messages
                if (!this.opts.old && Date.now() - req.time >= this.timeout) {
                    warn('Ignoring timed-out request')
                    return
                }

                // Check for cancelling request
                if (req[CANCEL_KEY]) {
                    let gen = this.requests[id]
                    delete this.requests[id]

                    if (typeof (gen && gen.return) === 'function') {
                        // Stop generator
                        gen.return()
                    }

                    return
                }

                this.requests[id] = true
                if (listener.length === 3) {
                    this.ready.then(() => listener(req, data, respond))
                } else {
                    let resp = listener(req, data)
                    this.ready.return(resp).then(resp => {
                        // Check for generator
                        if (typeof (resp && resp.next) === 'function') {
                            // Keep track of generator to later close it
                            this.requests[id] = resp

                            // Asynchronously use generator
                            let self = this
                            ;(function generate (gen) {
                                let resp = gen.next()

                                if (resp.done) {
                                    delete self.requests[id]
                                } else {
                                    respond(resp.value)
                                        .return(gen)
                                        .then(generate)
                                }
                            })(resp)
                        } else {
                            respond(resp).then(() => delete this.requests[id])
                        }
                    })
                }

                let self = this
                function respond (resp) {
                    return Bluebird.resolve(resp)
                        .then(resp => {
                            if (!Array.isArray(resp)) {
                                return resp === undefined ? [] : [resp]
                            }
                            return resp
                        })
                        .each(resp => {
                            if (resp[REQ_ID_KEY] === null) {
                                // TODO: Remove once everything migrated
                                resp[REQ_ID_KEY] = uuid()
                                util.deprecate(() => {},
                                'Please use ReResponder instead')()
                            } else {
                                resp[REQ_ID_KEY] = id
                                // Check for cancelled requests
                                if (!self.requests[id]) {
                                    throw new Error('Request cancelled')
                                }
                            }

                            resp.domain = domain
                            resp.group = group
                            return self.produce({ mesg: resp, part })
                        })
                        .finally(() => {
                            // TODO: Handle committing better
                            //this.consumer.commit(data);
                        })
                }
            })
        } else {
            return super.on(event, listener)
        }
    }
}
