'use strict';
const error = require('debug')('http-handler:websockets:error');
const trace = require('debug')('http-handler:websockets:trace');

const jsonpointer = require('jsonpointer');

const oadaError = require('oada-error');
const OADAError = oadaError.OADAError;

const WebSocket = require('ws')
const uuid = require('uuid');
const axios = require('axios');

const EventEmitter = require('events');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config')

const emitter = new EventEmitter();

module.exports = function wsHandler(server) {
    const ws = new WebSocket.Server({
        server,
    })

    // Add socket to storage
    ws.on('connection', function connection(socket, req) {

        socket.isAlive = true;
        socket.on('pong', function heartbeat() {
            socket.isAlive = true;
        });

        // Clean up socket from storage
        socket.on('close', function close() {
            if(socket.sessionId && sessions[socket.sessionId]) {
                delete sessions[socket.sessionsId];
                delete socket.sessionid;
            }
        });

        // Handle request
        socket.on('message', function message(msg) {
            try {
               msg = JSON.parse(msg);
            } catch (e) {
                let err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400, 'Invalid JSON')
                };
                socket.send(JSON.stringify(err));
                error(e);
                return;
            }

            if (!msg.requestId) {
                let err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400,
                        'Missing `requestId`')
                };
                socket.send(JSON.stringify(err));
                return;
            }

            if (!msg.path) {
                let err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400, 'Missing `path`')
                };
                err.requestId = msg.requestId;
                socket.send(JSON.stringify(err));
                return;
            }

            if (!msg.headers || !msg.headers.authorization) {
                let err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400,
                        'Missing `authorization`')
                };
                err.requestId = msg.requestId;

                socket.send(JSON.stringify(err));
                return;
            }

            if (!msg.method) {
                let err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400, 'Missing `method`')
                };
                err.requestId = msg.requestId;
                socket.send(JSON.stringify(err));
                return;
            }

            if (['unwatch', 'watch', 'head', 'get', 'put', 'post', 'delete'].includes(msg.method.toLowerCase()) == false) {
                let err = {
                    status: 400,
                    headers: [],
                    data: new OADAError('Bad Request', 400, 'Method `'+msg.method+'` is not supported.')
                };
                err.requestId = msg.requestId;
                socket.send(JSON.stringify(err));
                return;
            }

            let request = {
                baseURL: 'http://127.0.0.1',
                headers: msg.headers

            };
            switch(msg.method.toLowerCase()) {
                case 'unwatch':
                    request.method = 'head';
                    request.url = msg.path;
                break;

                case 'watch':
                    request.method = 'head';
                    request.url = msg.path;
                break;

                case 'head':
                    request.method = 'head';
                    request.url = msg.path;
                break;

                case 'get':
                    request.method = 'get';
                    request.url = msg.path;
                break;

                case 'post':
                    request.method = 'post';
                    request.url = msg.path;
                    request.data = msg.data;
                break;

                case 'put':
                    request.method = 'put';
                    request.url = msg.path;
                    request.data = msg.data;
                break;

                case 'delete':
                    request.method = 'delete';
                    request.url = msg.path;
                break;
            }
            axios(request)
            .then(function(res) {
                    if (msg.method === 'delete') {
                        let parts = res.headers['content-location'].split('/');
                        if (parts.length === 3) { // it is a resource
                          let resourceId = `${parts[1]}/${parts[2]}`;
                          trace('deleting a watched resource. closing watch', resourceId)
                          emitter.removeAllListeners(resourceId);
                        }
                    }
                    if (msg.method === 'unwatch') {
                        let parts = res.headers['content-location'].split('/');
                        let resourceId = `${parts[1]}/${parts[2]}`;
                        trace('closing watch', resourceId)
                      //trace('************, closing watch', resourceId);
                        //TODO: ensure this doesn't remove others
                        emitter.removeAllListeners(resourceId);

                        socket.send(JSON.stringify({
                            requestId: msg.requestId,
                            status: 'success'
                        }));

                    } else if (msg.method === 'watch') {
                        let parts = res.headers['content-location'].split('/');
                        let resourceId = `${parts[1]}/${parts[2]}`;
                        let path_leftover = parts.slice(3).join('/');
                        if(path_leftover) {
                          path_leftover = `/${path_leftover}`;
                          /*
                          socket.send(JSON.stringify({
                              requestId: msg.requestId,
                              status: 'success'
                          }));*/
                        }

                        var listeners = emitter.listeners(resourceId)
                        trace('listeners', listeners)
                        if (listeners.length === 0) {
                          let handleChange = function(change) {
                            //let c = change.change.merge || change.change.delete;
                            trace('responding watch', resourceId, change.change.body)
                              if (jsonpointer.get(change.change.body, path_leftover) !== undefined) {
                                  let message = {
                                      requestId: msg.requestId,
                                      resourceId,
                                      change: change.change,
                                  };

                                  socket.send(JSON.stringify(message));
                              }
                          };

                          trace('opening watch', resourceId)
                          emitter.on(resourceId, handleChange);

                          // Emit all new changes from the given rev in the request
                          if (request.headers['x-oada-rev']) {
                            oadaLib.changes.getChangesSinceRev(resourceId, request.headers['x-oada-rev']).then((changes) => {
                              var rev = request.headers['x-oada-rev'];
                              changes.forEach((change) => {
                                emitter.emit(resourceId, {
                                  path_leftover,
                                  change
                                })
                              })
                            })
                          }
                        }

                        socket.on('close', function handleClose() {
                            emitter.removeAllListeners(resourceId);
                        });

                        socket.send(JSON.stringify({
                            requestId: msg.requestId,
                            status: 'success'
                        }));
                    } else {
                        socket.send(JSON.stringify({
                            requestId: msg.requestId,
                            status: res.status,
                            headers: res.headers,
                            data: res.data,
                        }));
                    }
                })
            .catch(function(err) {

                    let e;
                    if (err.response) {
                        e = {
                            status: err.response.status,
                            statusText: err.response.statusText,
                            headers: err.response.headers,
                            data: err.response.data
                        };
                    } else {
                        error(err);
                        e = {
                            status: 500,
                            headers: [],
                            data: new OADAError('Internal Error', 500)
                        };
                    }
                    e.requestId = msg.requestId;
                    socket.send(JSON.stringify(e));
                });
        });
    });

    const interval = setInterval(function ping() {
        ws.clients.forEach(function each(socket) {
            if (socket.isAlive === false) {
                return socket.terminate();
            }

            socket.isAlive = false;
            socket.ping('', false, true);
        });
    }, 30000);
}

const writeResponder = new Responder(
	config.get('kafka:topics:httpResponse'),
	null,
	'websockets');

// Listen for successful write requests to resources of interest, then emit an event
writeResponder.on('request', function handleReq(req) {
    if (req.msgtype !== 'write-response' || req.code !== 'success') {
        return;
    }

	trace('@@@@@@@@@@@@@@@', req.resource_id);

    oadaLib.changes
        .getChange(req.resource_id, req._rev)
        .then((change) => {
            trace('00000000000000000 Emitted change for:', req.resource_id, req, change);
            emitter.emit(req.resource_id, {
                path_leftover: req.path_leftover,
                change
            });
        })
        .catch((e) => {
            error(e);
        });
});
