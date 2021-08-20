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

import { strict as assert } from 'assert';
import { EventEmitter } from 'events';

import { changes, resources } from '@oada/lib-arangodb';
import { KafkaBase, Responder } from '@oada/lib-kafka';

import type Change from '@oada/types/oada/change/v2';
import type SocketChange from '@oada/types/oada/websockets/change';
import SocketRequest, {
  // Runtime check for request type
  assert as assertRequest,
} from '@oada/types/oada/websockets/request';
import type SocketResponse from '@oada/types/oada/websockets/response';
import type { WriteResponse } from '@oada/write-handler';

import config from './config';

import _debug from 'debug';
import type { FastifyPluginAsync } from 'fastify';
import fastifyWebsocket from 'fastify-websocket';
import jsonpointer from 'jsonpointer';
import type LightMyRequest from 'light-my-request';
import { OADAError } from 'oada-error';
import { is } from 'type-is';
import type WebSocket from 'ws';

/**
 * @todo Actually figure out how "foregtting history" should work...
 */
const revLimit = Infinity;

const info = _debug('websockets:info');
const error = _debug('websockets:error');
const warn = _debug('websockets:warn');
const debug = _debug('websockets:debug');
const trace = _debug('websockets:trace');

const emitter = new EventEmitter();

type Watch = {
  handler: (this: Watch, { change }: { change: Change }) => void;
  /**
   * @description Maps requestId to path_leftover
   */
  //requests: { [requestId: string]: string };
  requests: Map<string, string>;
};

function parseRequest(data: WebSocket.Data): SocketRequest {
  assert(typeof data === 'string');
  const msg: unknown = JSON.parse(data);

  // Assert type
  assertRequest(msg);

  // Normalize header name capitalization
  const headers = msg.headers ?? {};
  for (const header of Object.keys(headers)) {
    headers[header.toLowerCase()] = headers[header];
  }

  return { ...msg, headers };
}

const plugin: FastifyPluginAsync = async function (fastify) {
  await fastify.register(fastifyWebsocket);

  fastify.get('/*', { websocket: true }, ({ socket }) => {
    // Add our state stuff?
    let isAlive = true;
    const watches: Map<string, Watch> = new Map();

    // Set up periodic ping/pong and timeout on socket
    const interval = setInterval(function ping() {
      if (isAlive === false) {
        return socket.terminate();
      }

      isAlive = false;
      socket.ping();
    }, 30000);
    socket.on('pong', function heartbeat() {
      isAlive = true;
    });
    socket.on('close', () => clearInterval(interval));

    function handleChange(resourceId: string): Watch['handler'] {
      function handler(this: Watch, { change }: { change: Change }) {
        debug('responding watch %s', resourceId);

        const requests =
          watches.get(resourceId)?.requests ?? new Map<string, string>();

        const mesg = {
          resourceId,
          change,
          requestId: [] as string[],
          path_leftover: [] as string[],
        };
        for (const [requestId, path_leftover] of requests) {
          // Find requests with changes
          const pathChange: unknown = jsonpointer.get(
            change?.[0]?.body ?? {},
            path_leftover
          );
          if (pathChange === undefined) {
            continue;
          }

          mesg.requestId.push(requestId);
          mesg.path_leftover.push(path_leftover);
        }

        sendChange(mesg as SocketChange);
      }
      return handler;
    }
    function sendResponse({
      payload,
      ...resp
    }: SocketResponse & { payload?: string }) {
      debug('Responding to request: %O', resp);
      // TODO: Remove this hack...
      const str = JSON.stringify(resp);
      if (payload) {
        socket.send(`${str.slice(0, -1)},"data":${payload}}`);
      } else {
        socket.send(str);
      }
    }
    function sendChange(resp: SocketChange) {
      trace(resp, 'Sending change');
      socket.send(JSON.stringify(resp));
    }

    // Handle request
    socket.on('message', async function message(data) {
      let msg: SocketRequest;
      try {
        msg = parseRequest(data);
      } catch (e) {
        const err: SocketResponse = {
          status: 400,
          /**
           * TODO: the heck??
           */
          requestId: ['error'],
          headers: {},
          data: new OADAError(
            'Bad Request',
            400,
            'Invalid socket message format',
            null,
            e
          ) as Record<string, unknown>,
        };
        sendResponse(err);
        error(e);
        return;
      }

      try {
        await handleRequest(msg);
      } catch (e) {
        error(e);
        error('Request was: %O', msg);
        const err = {
          status: 500,
          requestId: msg.requestId,
          headers: {},
          data: new OADAError('Internal Error', 500) as Record<string, unknown>,
        };
        sendResponse(err);
      }
    });

    async function handleRequest(msg: SocketRequest) {
      info(
        'Handling socket req %s: %s %s',
        msg.requestId,
        msg.method,
        msg.path
      );
      trace(msg);

      const request: LightMyRequest.InjectOptions = {
        url: msg.path,
        headers: {
          // Pass requestId along to main code for easier tracking
          'X-Request-ID': msg.requestId,
          ...msg.headers,
        },
      };
      switch (msg.method) {
        case 'ping':
          debug('ping');
          // Send an empty response
          sendResponse({
            requestId: msg.requestId,
            status: 204, // HTTP 204: No Content
          });
          return;
        case 'unwatch': {
          debug('closing watch', msg.requestId);

          // Find corresponding WATCH
          let res: string | undefined;
          let watch: Watch | undefined;
          let found = false;
          for ([res, watch] of watches) {
            if (watch?.requests.get(msg.requestId)) {
              found = true;
              break;
            }
          }

          if (!found || !watch || !res) {
            warn('Received UNWATCH for unknown WATCH %s', msg.requestId);
          } else {
            watch.requests.delete(msg.requestId);
            if (watch.requests.size === 0) {
              // No watches on this resource left
              watches.delete(res);
              emitter.removeListener(res, watch.handler);
            }
          }
          sendResponse({
            requestId: msg.requestId,
            status: 200,
          });

          // No actual request to make for UNWATCH
          return;
        }
        case 'watch':
          request.method = 'head';
          break;

        case 'put':
        case 'post':
          request.payload = JSON.stringify(msg.data);
        default:
          request.method = msg.method;
          break;
      }
      let res: LightMyRequest.Response;
      try {
        res = await fastify.inject(request);
        // Treat any status above 2xx as error?
        if (res.statusCode >= 300) {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            // @oada/client gets very angry if a header is anything but a string
            if (v) {
              headers[k] = v.toString();
            }
          }
          return sendResponse({
            requestId: msg.requestId,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers,
            payload: res.payload,
          });
        }
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'response' in err) {
          error(err);
          const {
            response: { status, statusText, headers, data },
          } = err as {
            response: {
              status: number;
              statusText: string;
              headers: Record<string, string>;
              data: Record<string, unknown>;
            };
          };
          return sendResponse({
            requestId: msg.requestId,
            status,
            statusText,
            headers,
            data,
          });
        } else {
          throw err;
        }
      }
      const parts =
        res.headers['content-location']?.toString().split('/') ?? [];
      let path_leftover = '';
      assert(parts.length >= 3);
      const resourceId = `${parts[1]!}/${parts[2]!}`;
      if (parts.length > 3) {
        path_leftover = parts.slice(3).join('/');
      }
      if (path_leftover) {
        path_leftover = `/${path_leftover}`;
      }

      switch (msg.method) {
        case 'watch': {
          debug('opening watch %s', msg.requestId);

          const watch = watches.get(resourceId);
          if (!watch) {
            // No existing WATCH on this resource
            const newwatch = {
              handler: handleChange(resourceId),
              requests: new Map<string, string>().set(
                msg.requestId,
                path_leftover
              ),
            };
            watches.set(resourceId, newwatch);

            emitter.on(resourceId, newwatch.handler);
            socket.on('close', function handleClose() {
              emitter.removeListener(resourceId, newwatch.handler);
            });
          } else {
            // Already WATCHing this resource
            watch.requests.set(msg.requestId, path_leftover);
          }

          // Emit all new changes from the given rev in the request
          if (request.headers?.['x-oada-rev'] !== undefined) {
            debug('Setting up watch on: %s', resourceId);
            trace(
              'RECEIVED THIS REV: %s %s',
              resourceId,
              request.headers['x-oada-rev']
            );
            const rev = await resources.getResource(resourceId, '_rev');
            const revInt = parseInt(rev as unknown as string, 10);
            // If the requested rev is behind by revLimit, simply
            // re-GET the entire resource
            trace(
              'REVS: %s %s %s',
              resourceId,
              rev,
              request.headers['x-oada-rev']
            );
            if (
              revInt - parseInt(request.headers['x-oada-rev'] as string, 10) >=
              revLimit
            ) {
              trace(
                'REV WAY OUT OF DATE %s: %s %s',
                resourceId,
                rev,
                request.headers['x-oada-rev']
              );
              const resource = await resources.getResource(resourceId);
              sendResponse({
                requestId: msg.requestId,
                resourceId,
                resource,
                status: 200,
              });
            } else {
              // First, declare success.
              sendResponse({
                requestId: msg.requestId,
                status: 200,
              });
              trace(
                'REV NOT TOO OLD %s: %s %s',
                resourceId,
                rev,
                request.headers['x-oada-rev']
              );
              // Next, feed changes to client
              const reqRevInt = parseInt(
                request.headers['x-oada-rev'] as string,
                10
              );
              for (let sendRev = reqRevInt + 1; sendRev <= revInt; sendRev++) {
                trace(
                  'Sending change %s to resumed WATCH %s',
                  sendRev,
                  msg.requestId
                );
                await changes
                  .getChangeArray(resourceId, sendRev)
                  .then((change) => {
                    sendChange({
                      requestId: [msg.requestId],
                      resourceId,
                      path_leftover,
                      change,
                    });
                  });
              }
            }
          } else {
            sendResponse({
              requestId: msg.requestId,
              status: 200,
            });
          }
          break;
        }
        case 'delete':
          if (parts.length === 3) {
            // it is a resource
            emitter.removeAllListeners(resourceId);
          }
        case 'get': {
          // Can only send JSON over websockets
          const type = res.headers['content-type']?.toString();
          if (type && !is(type, ['json', '+json'])) {
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(res.headers)) {
              if (v) {
                headers[k] = v.toString();
              }
            }
            sendResponse({
              requestId: msg.requestId,
              // Bad Request
              status: 400,
              statusText: 'Cannot GET binary over WebSockets',
              headers,
            });
            return;
          }
        }
        default: {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            // @oada/client gets very angry if a header is anything but a string
            if (v) {
              headers[k] = v.toString();
            }
          }
          sendResponse({
            requestId: msg.requestId,
            status: res.statusCode,
            headers,
            // TODO: why is there a payload for HEAD??
            payload: msg.method === 'head' ? undefined : res.payload,
          });
        }
      }
    }
  });

  const writeResponder = new Responder({
    consumeTopic: config.get('kafka.topics.httpResponse'),
    group: 'websockets',
  });

  fastify.addHook('onClose', async () => {
    await writeResponder.disconnect();
  });

  function checkReq(req: KafkaBase): req is WriteResponse {
    return req.msgtype === 'write-response' && req.code === 'success';
  }
  /**
   * Listen for successful write requests to resources of interest, then emit an event
   */
  writeResponder.on('request', async function handleReq(req) {
    if (!checkReq(req)) {
      return;
    }

    try {
      const change = await changes.getChangeArray(req.resource_id, req._rev);
      trace('Emitted change for %s: %O', req.resource_id, change);
      emitter.emit(req.resource_id, {
        path_leftover: req.path_leftover,
        change,
      });
      if (change?.[0]?.type === 'delete') {
        trace(change, 'Delete change received');
        if (req.resource_id && req.path_leftover === '') {
          debug('Removing all listeners to: %s', req.resource_id);
          emitter.removeAllListeners(req.resource_id);
        }
      }
    } catch (e) {
      error(e);
    }
  });
};

export default plugin;
