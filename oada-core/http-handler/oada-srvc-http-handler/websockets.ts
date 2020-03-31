import { resolve } from 'path'
import { strict as _assert } from 'assert'

import debug from 'debug'

import * as jsonpointer from 'jsonpointer'
import * as Ajv from 'ajv'

import { OADAError } from 'oada-error'

import * as WebSocket from 'ws'
// prettier-ignore
import type { Server } from 'http'
import axios, { AxiosRequestConfig } from 'axios'

import * as TJS from 'typescript-json-schema'

import { EventEmitter } from 'events'
import { Responder, KafkaReguest } from '../../libs/oada-lib-kafka'
import { resources, changes, Change } from '../../libs/oada-lib-arangodb'
import config from './config'
const revLimit = 10

const info = debug('websockets:info')
const error = debug('websockets:error')
const warn = debug('websockets:warn')
const trace = debug('websockets:trace')

const emitter = new EventEmitter()

// Make sure we stringify the http request data ourselves
type RequestData = string & { __reqData__: void }
interface HTTPRequest extends AxiosRequestConfig {
    data?: RequestData
}
function serializeRequestData (data: any): RequestData {
    return JSON.stringify(data) as RequestData
}

/**
 * Call node's strict assert function
 * @todo Fix declaration rather than wrapping in new function?
 */
function assert (value: any, message?: string | Error): asserts value {
    return _assert(value, message)
}

// Add our state to the websocket type?
interface Socket extends WebSocket {
    isAlive: boolean
    /**
     * @description Indexed by resourceId
     */
    watches: { [key: string]: Watch }
}
type Watch = {
    handler: (this: Watch, { change }: { change: Change }) => any
    /**
     * @description Maps requestId to path_leftover
     */
    requests: { [key: string]: string }
}

export type SocketRequest = {
    requestId: string
    path: string
    method: 'head' | 'get' | 'put' | 'post' | 'delete' | 'watch' | 'unwatch'
    headers: { authorization: string | number } & {
        [key: string]: string | number
    }
    data?: any
}

export type SocketResponse = {
    requestId: string | string[]
    /**
     * @todo Why is this weird?
     */
    status: 'success' | number
    // TODO: Figure out this mess of responses...
    statusText?: string
    headers?: { [key: string]: string }
    resourceId?: string
    resource?: any
    data?: any
}

export type SocketChange = {
    requestId: string[]
    resourceId: string
    path_leftover: string | string[]
    change: Change
}

/**
 * Check incoming requests against schema since they are coming over network
 *
 * This way the rest of the code can assume the format is correct
 */
const ajv = new Ajv()
const program = TJS.programFromConfig(resolve('./tsconfig.json'))
// Precompile schema validator
const requestValidator = ajv.compile(
    TJS.generateSchema(program, 'SocketRequest') as object
)
function parseRequest (data: WebSocket.Data): SocketRequest {
    function assertRequest (value: any): asserts value is SocketRequest {
        if (!requestValidator(value)) {
            throw requestValidator.errors
        }
    }

    assert(typeof data === 'string')
    const msg = JSON.parse(data)

    // Normalize method capitalization
    msg.method = msg?.method?.toLowerCase()
    // Normalize header name capitalization
    const headers = msg?.headers ?? {}
    msg.headers = {}
    for (const header in headers) {
        msg.headers[header.toLowerCase()] = headers[header]
    }

    // Assert type schema
    assertRequest(msg)

    return msg
}

module.exports = function wsHandler (server: Server) {
    const wss = new WebSocket.Server({ server })

    // Add socket to storage
    wss.on('connection', function connection (socket: Socket) {
        // Add our state stuff?
        socket.isAlive = true
        socket.watches = {}
        socket.on('pong', function heartbeat () {
            socket.isAlive = true
        })
        function handleChange (resourceId: string): Watch['handler'] {
            function handler (this: Watch, { change }: { change: Change }) {
                trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
                trace('responding watch', resourceId)
                trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')

                const { requests } = socket.watches[resourceId]

                let mesg: SocketChange = {
                    requestId: [],
                    resourceId,
                    path_leftover: [],
                    change
                }
                mesg = Object.keys(requests)
                    // Find requests with changes
                    .filter(requestId => {
                        const path_leftover = requests[requestId]
                        const pathChange = jsonpointer.get(
                            change?.body ?? {},
                            path_leftover
                        )

                        return pathChange !== undefined
                    })
                    // Mux into one change message
                    .reduce(
                        ({ requestId, path_leftover, ...rest }, id) => ({
                            requestId: requestId.concat(id),
                            path_leftover: path_leftover.concat(requests[id]),
                            ...rest
                        }),
                        mesg
                    )
                sendChange(mesg)
            }
            return handler
        }
        function sendResponse (resp: SocketResponse) {
            trace('Responding to request: %O', resp)
            socket.send(JSON.stringify(resp))
        }
        function sendChange (resp: SocketChange) {
            const msg = {
                ...resp,
                // Try to not confuse old versions of oada-cache
                requestId:
                    resp.requestId.length === 1
                        ? resp.requestId[0]
                        : resp.requestId
            }
            socket.send(JSON.stringify(msg))
        }

        // Handle request
        socket.on('message', async function message (data) {
            let msg: SocketRequest
            try {
                msg = parseRequest(data)
            } catch (e) {
                const err = {
                    status: 400,
                    requestId: [],
                    headers: {},
                    data: new OADAError(
                        'Bad Request',
                        400,
                        'Invalid socket message format',
                        null,
                        e
                    )
                }
                sendResponse(err)
                error(e)
                return
            }

            try {
                await handleRequest(msg)
            } catch (e) {
                error(e)
                const err = {
                    status: 500,
                    requestId: msg.requestId,
                    headers: {},
                    data: new OADAError('Internal Error', 500)
                }
                sendResponse(err)
            }
        })

        async function handleRequest (msg: SocketRequest) {
            info(`Handling socket req ${msg.requestId}:`, msg.method, msg.path)

            const request: HTTPRequest = {
                baseURL: 'http://127.0.0.1',
                url: msg.path,
                headers: msg.headers
            }
            switch (msg.method) {
                case 'unwatch':
                    trace('closing watch', msg.requestId)

                    // Find corresponding WATCH
                    let res
                    let watch
                    for (res in socket.watches) {
                        watch = socket.watches[res]
                        if (watch.requests[msg.requestId]) {
                            break
                        }
                    }

                    if (!watch) {
                        warn(
                            `Received UNWATCH for unknown WATCH ${msg.requestId}`
                        )
                    } else {
                        delete watch.requests[msg.requestId]
                        if (Object.keys(watch.requests).length === 0) {
                            // No watches on this resource left
                            delete socket.watches[res as string]
                            emitter.removeListener(res as string, watch.handler)
                        }
                    }
                    sendResponse({
                        requestId: msg.requestId,
                        status: 200
                    })

                    // No actual request to make for UNWATCH
                    return
                case 'watch':
                    request.method = 'head'
                    break

                case 'put':
                case 'post':
                    request.data = serializeRequestData(msg.data)
                default:
                    request.method = msg.method
                    break
            }
            let res
            try {
                res = await axios.request<any>(request)
            } catch (err) {
                if (err.response) {
                    const e = {
                        requestId: msg.requestId,
                        status: err.response.status,
                        statusText: err.response.statusText,
                        headers: err.response.headers,
                        data: err.response.data
                    }
                    return sendResponse(e)
                } else {
                    throw err
                }
            }
            const parts = res.headers['content-location'].split('/')
            let resourceId: string
            let path_leftover = ''
            assert(parts.length >= 3)
            resourceId = `${parts[1]}/${parts[2]}`
            if (parts.length > 3) path_leftover = parts.slice(3).join('/')
            if (path_leftover) {
                path_leftover = `/${path_leftover}`
            }

            switch (msg.method) {
                case 'watch':
                    trace('opening watch', msg.requestId)

                    let watch: Watch = socket.watches[resourceId]
                    if (!watch) {
                        // No existing WATCH on this resource
                        watch = {
                            handler: handleChange(resourceId),
                            requests: { [msg.requestId]: path_leftover }
                        }
                        socket.watches[resourceId] = watch

                        emitter.on(resourceId, watch.handler)
                        socket.on('close', function handleClose () {
                            emitter.removeListener(resourceId, watch.handler)
                        })
                    } else {
                        // Already WATCHing this resource
                        watch.requests[msg.requestId] = path_leftover
                    }

                    // Emit all new changes from the given rev in the request
                    if (request.headers['x-oada-rev']) {
                        trace('Setting up watch on:', resourceId)
                        trace(
                            'RECEIVED THIS REV:',
                            resourceId,
                            request.headers['x-oada-rev']
                        )
                        const rev = await resources.getResource(
                            resourceId,
                            '_rev'
                        )
                        // If the requested rev is behind by revLimit, simply
                        // re-GET the entire resource
                        trace(
                            'REVS:',
                            resourceId,
                            rev,
                            request.headers['x-oada-rev']
                        )
                        if (
                            parseInt(rev) -
                                parseInt(request.headers['x-oada-rev']) >=
                            revLimit
                        ) {
                            trace(
                                'REV WAY OUT OF DATE',
                                resourceId,
                                rev,
                                request.headers['x-oada-rev']
                            )
                            const resource = await resources.getResource(
                                resourceId
                            )
                            sendResponse({
                                requestId: msg.requestId,
                                resourceId,
                                resource,
                                status: 'success'
                            })
                        } else {
                            // First, declare success.
                            sendResponse({
                                requestId: msg.requestId,
                                status: 'success'
                            })
                            trace(
                                'REV NOT TOO OLD...',
                                resourceId,
                                rev,
                                request.headers['x-oada-rev']
                            )
                            // Next, feed changes to client
                            const newChanges = await changes.getChangesSinceRev(
                                resourceId,
                                request.headers['x-oada-rev']
                            )
                            newChanges.forEach(change =>
                                sendChange({
                                    requestId: [msg.requestId],
                                    resourceId,
                                    path_leftover,
                                    change
                                })
                            )
                        }
                    } else {
                        sendResponse({
                            requestId: msg.requestId,
                            status: 'success'
                        })
                    }
                    break

                case 'delete':
                    if (parts.length === 3) {
                        // it is a resource
                        emitter.removeAllListeners(resourceId)
                    }
                default:
                    sendResponse({
                        requestId: msg.requestId,
                        status: res.status,
                        headers: res.headers,
                        data: res.data
                    })
            }
        }
    })

    const interval = setInterval(function ping () {
        wss.clients.forEach(function each (sock) {
            const socket = sock as Socket // TODO: Better way to do this?
            if (socket.isAlive === false) {
                return socket.terminate()
            }

            socket.isAlive = false
            socket.ping()
        })
    }, 30000)

    wss.on('close', function close () {
        clearInterval(interval)
    })
}

const writeResponder = new Responder({
    consumeTopic: config.get('kafka:topics:httpResponse') as string,
    group: 'websockets'
})

type WriteResponse = {
    msgtype: 'write-response'
    code: 'success'
    resource_id: string
    path_leftover: string
    _rev: number
}
function checkReq (req: KafkaReguest): req is WriteResponse {
    return req.msgtype === 'write-response' && req.code === 'success'
}
// Listen for successful write requests to resources of interest, then emit an event
writeResponder.on('request', async function handleReq (req) {
    if (!checkReq(req)) {
        return
    }

    trace('@@@@@@@@@@@@@@@', req.resource_id)
    try {
        const change = await changes.getChange(req.resource_id, req._rev)
        trace('Emitted change for:', req.resource_id, change)
        emitter.emit(req.resource_id, {
            path_leftover: req.path_leftover,
            change
        })
        if (change && change.type === 'delete') {
            trace(
                'Delete change received for:',
                req.resource_id,
                req.path_leftover,
                change
            )
            if (req.resource_id && req.path_leftover === '') {
                trace('Removing all listeners to:', req.resource_id)
                emitter.removeAllListeners(req.resource_id)
            }
        }
    } catch (e) {
        error(e)
    }
})
