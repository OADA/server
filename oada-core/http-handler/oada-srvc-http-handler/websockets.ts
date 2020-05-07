import { strict as assert } from 'assert'

import debug from 'debug'

import * as jsonpointer from 'jsonpointer'

import { OADAError } from 'oada-error'

import * as WebSocket from 'ws'
// prettier-ignore
import type { Server } from 'http'
import axios, { AxiosRequestConfig } from 'axios'

import { EventEmitter } from 'events'

import SocketRequest, {
    // Runtime check for request type
    assert as assertRequest
} from '@oada/types/oada/websockets/request'
import SocketResponse from '@oada/types/oada/websockets/response'
import SocketChange from '@oada/types/oada/websockets/change'

import { Responder, KafkaRequest } from '../../libs/oada-lib-kafka'
import { resources, changes, Change } from '../../libs/oada-lib-arangodb'
// @ts-ignore
import * as config from './config'
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

function parseRequest (data: WebSocket.Data): SocketRequest {
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

    // Assert type
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

                const mesg: SocketChange = Object.keys(requests)
                    // Find requests with changes
                    .filter(requestId => {
                        const path_leftover = requests[requestId]
                        const pathChange = jsonpointer.get(
                            change?.[0]?.body ?? {},
                            path_leftover
                        )

                        return pathChange !== undefined
                    })
                    // Mux into one change message
                    .reduce<Partial<SocketChange>>(
                        (
                            { requestId = [], path_leftover = [], ...rest },
                            id
                        ) => ({
                            requestId: [id, ...requestId],
                            path_leftover: [requests[id], ...path_leftover],
                            ...rest
                        }),
                        { resourceId, change }
                    ) as SocketChange

                sendChange(mesg)
            }
            return handler
        }
        function sendResponse (resp: SocketResponse) {
            trace('Responding to request: %O', resp)
            socket.send(JSON.stringify(resp))
        }
        function sendChange (resp: SocketChange) {
            trace('Sending change: %O', resp);
            socket.send(JSON.stringify(resp))
        }

        // Handle request
        socket.on('message', async function message (data) {
            let msg: SocketRequest
            try {
                msg = parseRequest(data)
            } catch (e) {
                const err = {
                    status: 400,
                    // TODO: the heck??
                    requestId: ['error'] as [string],
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
                    error(err)
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
                        const revInt = parseInt(rev)
                        // If the requested rev is behind by revLimit, simply
                        // re-GET the entire resource
                        trace(
                            'REVS:',
                            resourceId,
                            rev,
                            request.headers['x-oada-rev']
                        )
                        if (
                            revInt - parseInt(request.headers['x-oada-rev']) >=
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
                            let reqRevInt = parseInt(
                                request.headers['x-oada-rev']
                            )
                            for (
                                let sendRev = reqRevInt + 1;
                                sendRev <= revInt;
                                sendRev++
                            ) {
                                await changes
                                    .getChangeArray(resourceId, sendRev)
                                    .then(change => {
                                        sendChange({
                                            requestId: [msg.requestId],
                                            resourceId,
                                            path_leftover,
                                            change
                                        })
                                    })
                            }
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
function checkReq (req: KafkaRequest): req is WriteResponse {
    return req.msgtype === 'write-response' && req.code === 'success'
}
// Listen for successful write requests to resources of interest, then emit an event
writeResponder.on('request', async function handleReq (req) {
    if (!checkReq(req)) {
        return
    }

    try {
        const change = await changes.getChangeArray(req.resource_id, req._rev)
        trace('Emitted change for:', req.resource_id, change)
        emitter.emit(req.resource_id, {
            path_leftover: req.path_leftover,
            change
        })
        if (change && change?.[0]?.type === 'delete') {
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
