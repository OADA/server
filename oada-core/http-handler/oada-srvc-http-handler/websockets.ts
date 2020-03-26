import { strict as _assert } from 'assert'

import debug from 'debug'

import jsonpointer from 'jsonpointer'

import { OADAError } from 'oada-error'

import WebSocket from 'ws'
// prettier-ignore
import type { Server } from 'https'
import axios, { AxiosRequestConfig } from 'axios'

import { EventEmitter } from 'events'
import { Responder, KafkaReguest } from '../../libs/oada-lib-kafka'
import { resources, changes, Change } from '../../libs/oada-lib-arangodb'
import config from './config'
const revLimit = 10

const error = debug('websockets:error')
const trace = debug('websockets:trace')

const emitter = new EventEmitter()

type Message = {
    requestId: string | string[]
    path: string
    method: 'head' | 'get' | 'put' | 'post' | 'delete' | 'watch' | 'unwatch'
    headers: { [key: string]: string }
    data: any
}

// Make sure we stringify the request data ourselves
type RequestData = string & { __reqData__: void }
interface Request extends AxiosRequestConfig {
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

class Socket extends WebSocket {
    isAlive?: boolean
}

module.exports = function wsHandler (server: Server) {
    const wss = new WebSocket.Server({
        server
    })

    // Add socket to storage
    wss.on('connection', function connection (socket: Socket) {
        socket.isAlive = true
        socket.on('pong', function heartbeat () {
            socket.isAlive = true
        })

        function parseMessage (data: WebSocket.Data): Message {
            assert(typeof data === 'string')

            const msg = JSON.parse(data)
            // Normalize method
            msg.method = msg?.method?.toLowerCase() as Message['method']

            return msg
        }
        // Handle request
        socket.on('message', async function message (data) {
            let msg: Message
            try {
                msg = parseMessage(data)
            } catch (e) {
                const err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400, 'Invalid JSON')
                }
                socket.send(JSON.stringify(err))
                error(e)
                return
            }

            if (!msg.requestId) {
                const err = {
                    status: 400,
                    headers: [],
                    data: new OADAError(
                        'Bad Request',
                        400,
                        'Missing `requestId`'
                    )
                }
                socket.send(JSON.stringify(err))
                return
            }

            if (!msg.path) {
                const err = {
                    status: 400,
                    requestId: msg.requestId,
                    headers: [],
                    data: new OADAError('Bad Request', 400, 'Missing `path`')
                }

                socket.send(JSON.stringify(err))
                return
            }

            if (!msg?.headers?.authorization) {
                const err = {
                    status: 400,
                    requestId: msg.requestId,
                    headers: [],
                    data: new OADAError(
                        'Bad Request',
                        400,
                        'Missing `authorization`'
                    )
                }

                socket.send(JSON.stringify(err))
                return
            }

            if (
                [
                    'unwatch',
                    'watch',
                    'head',
                    'get',
                    'put',
                    'post',
                    'delete'
                ].includes(msg.method.toLowerCase()) === false
            ) {
                const err = {
                    status: 400,
                    requestId: msg.requestId,
                    headers: [],
                    data: new OADAError(
                        'Bad Request',
                        400,
                        'Method `' + msg.method + '` is not supported.'
                    )
                }
                socket.send(JSON.stringify(err))
                return
            }

            const request: Request = {
                baseURL: 'http://127.0.0.1',
                headers: msg.headers
            }
            function assertNever (method: never): never {
                const err = {
                    status: 400,
                    requestId: msg.requestId,
                    headers: [],
                    data: new OADAError(
                        'Bad Request',
                        400,
                        'Method `' + method + '` is not supported.'
                    )
                }
                throw err
            }
            try {
                switch (msg.method) {
                    default:
                        return assertNever(msg.method)
                    case 'unwatch':
                        request.method = 'head'
                        request.url = msg.path
                        trace('UNWATCH')
                        break

                    case 'watch':
                        request.method = 'head'
                        request.url = msg.path
                        break

                    case 'head':
                        request.method = 'head'
                        request.url = msg.path
                        break

                    case 'get':
                        request.method = 'get'
                        request.url = msg.path
                        break

                    case 'post':
                        request.method = 'post'
                        request.url = msg.path
                        request.data = serializeRequestData(msg.data)
                        break

                    case 'put':
                        request.method = 'put'
                        request.url = msg.path
                        request.data = serializeRequestData(msg.data)
                        break

                    case 'delete':
                        request.method = 'delete'
                        request.url = msg.path
                        break
                }
            } catch (err) {
                socket.send(JSON.stringify(err))
                return
            }
            try {
                const res = await axios(request)
                const parts = res.headers['content-location'].split('/')
                let resourceId: string
                let path_leftover = ''
                assert(parts.length >= 3)
                resourceId = `${parts[1]}/${parts[2]}`
                if (parts.length > 3) path_leftover = parts.slice(3).join('/')
                if (path_leftover) {
                    path_leftover = `/${path_leftover}`
                }

                function handleChange ({ change }: { change: Change }) {
                    // let c = change.change.merge || change.change.delete;
                    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
                    trace('responding watch', resourceId)
                    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
                    if (
                        change &&
                        jsonpointer.get(change.body, path_leftover) !==
                            undefined
                    ) {
                        const message = {
                            requestId: msg.requestId,
                            resourceId,
                            change
                        }
                        socket.send(JSON.stringify(message))
                    }
                }

                switch (msg.method) {
                    case 'delete':
                        if (parts.length === 3) {
                            // it is a resource
                            emitter.removeAllListeners(resourceId)
                        }
                        break

                    case 'unwatch':
                        trace('closing watch', resourceId)
                        emitter.removeListener(resourceId, handleChange)

                        socket.send(
                            JSON.stringify({
                                requestId: msg.requestId,
                                status: 'success'
                            })
                        )
                        break
                    case 'watch':
                        trace('opening watch', resourceId)
                        emitter.on(resourceId, handleChange)

                        socket.on('close', function handleClose () {
                            emitter.removeListener(resourceId, handleChange)
                        })

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
                                socket.send(
                                    JSON.stringify({
                                        requestId: msg.requestId,
                                        resourceId,
                                        resource,
                                        status: 'success'
                                    })
                                )
                            } else {
                                // First, declare success.
                                socket.send(
                                    JSON.stringify({
                                        requestId: msg.requestId,
                                        status: 'success'
                                    })
                                )
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
                                newChanges.forEach(change => {
                                    socket.send(
                                        JSON.stringify({
                                            requestId: msg.requestId,
                                            resourceId,
                                            path_leftover,
                                            change
                                        })
                                    )
                                })
                            }
                        } else {
                            socket.send(
                                JSON.stringify({
                                    requestId: msg.requestId,
                                    status: 'success'
                                })
                            )
                        }
                        break
                    default:
                        socket.send(
                            JSON.stringify({
                                requestId: msg.requestId,
                                status: res.status,
                                headers: res.headers,
                                data: res.data
                            })
                        )
                }
            } catch (err) {
                let e
                if (err.response) {
                    e = {
                        status: err.response.status,
                        statusText: err.response.statusText,
                        headers: err.response.headers,
                        data: err.response.data
                    }
                } else {
                    error(err)
                    e = {
                        status: 500,
                        requestId: msg.requestId,
                        headers: [],
                        data: new OADAError('Internal Error', 500)
                    }
                }
                socket.send(JSON.stringify(e))
            }
        })
    })

    const interval = setInterval(function ping () {
        wss.clients.forEach(function each (socket: Socket) {
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

const writeResponder = new Responder(
    config.get('kafka:topics:httpResponse'),
    null,
    'websockets'
)

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
