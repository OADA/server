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

import type WebSocket from 'ws';
import fastifyWebsocket from 'fastify-websocket';
import debug from 'debug';
import jsonpointer from 'jsonpointer';
import type LightMyRequest from 'light-my-request';

import SocketRequest, {
  // Runtime check for request type
  assert as assertRequest,
} from '@oada/types/oada/websockets/request';
import type SocketResponse from '@oada/types/oada/websockets/response';
import type SocketChange from '@oada/types/oada/websockets/change';
import type Change from '@oada/types/oada/change/v2';
import { OADAError } from 'oada-error';

import { Responder, KafkaBase } from '@oada/lib-kafka';
import { resources, changes } from '@oada/lib-arangodb';
import type { WriteResponse } from '@oada/write-handler';

import config from './config';
import type { FastifyPluginAsync } from 'fastify';

/**
 * @todo Actually figure out how "foregtting history" should work...
 */
const revLimit = Infinity;

const info = debug('websockets:info');
const error = debug('websockets:error');
const warn = debug('websockets:warn');
const trace = debug('websockets:trace');

const emitter = new EventEmitter();

// Make sure we stringify the http request data ourselves
type RequestData = string & { __reqData__: void };
function serializeRequestData(data: any): RequestData {
  return JSON.stringify(data) as RequestData;
}

type Watch = {
  handler: (this: Watch, { change }: { change: Change }) => any;
  /**
   * @description Maps requestId to path_leftover
   */
  requests: { [requestId: string]: string };
};

function parseRequest(data: WebSocket.Data): SocketRequest {
  assert(typeof data === 'string');
  const msg = JSON.parse(data);

  // Normalize method capitalization
  msg.method = msg?.method?.toLowerCase();
  // Normalize header name capitalization
  const headers = msg?.headers ?? {};
  msg.headers = {};
  for (const header in headers) {
    msg.headers[header.toLowerCase()] = headers[header];
  }

  // Assert type
  assertRequest(msg);

  return msg;
}

const plugin: FastifyPluginAsync = async function (fastify) {
  await fastify.register(fastifyWebsocket);

  fastify.get('/*', { websocket: true }, async ({ socket }, _request) => {
    // Add our state stuff?
    let isAlive: boolean = true;
    let watches: Record<string, Watch> = {};

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
        trace('responding watch %s', resourceId);

        const requests =
          watches[resourceId]?.requests ?? ({} as Record<string, string>);

        const mesg: SocketChange = Object.keys(requests)
          // Find requests with changes
          .filter((requestId: keyof typeof requests) => {
            const path_leftover = requests[requestId]!;
            const pathChange = jsonpointer.get(
              change?.[0]?.body ?? {},
              path_leftover
            );

            return pathChange !== undefined;
          })
          // Mux into one change message
          .reduce<Partial<SocketChange>>(
            ({ requestId = [], path_leftover = [], ...rest }, id) => ({
              requestId: [id, ...requestId],
              path_leftover: [requests[id]!, ...path_leftover],
              ...rest,
            }),
            { resourceId, change }
          ) as SocketChange;

        sendChange(mesg);
      }
      return handler;
    }
    function sendResponse(resp: SocketResponse) {
      trace('Responding to request: %O', resp);
      socket.send(JSON.stringify(resp));
    }
    function sendChange(resp: SocketChange) {
      trace('Sending change: %O', resp);
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
      info(`Handling socket req ${msg.requestId}:`, msg.method, msg.path);

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
          trace('ping');
          // Send an empty response
          sendResponse({
            requestId: msg.requestId,
            status: 204, // HTTP 204: No Content
          });
          return;
        case 'unwatch':
          trace('closing watch', msg.requestId);

          // Find corresponding WATCH
          let res: string | undefined;
          let watch: Watch | undefined;
          for (res in watches) {
            watch = watches[res];
            if (watch?.requests[msg.requestId]) {
              break;
            }
          }

          if (!watch) {
            warn(`Received UNWATCH for unknown WATCH ${msg.requestId}`);
          } else {
            delete watch.requests[msg.requestId];
            if (Object.keys(watch.requests).length === 0) {
              // No watches on this resource left
              delete watches[res!];
              emitter.removeListener(res!, watch.handler);
            }
          }
          sendResponse({
            requestId: msg.requestId,
            status: 200,
          });

          // No actual request to make for UNWATCH
          return;
        case 'watch':
          request.method = 'head';
          break;

        case 'put':
        case 'post':
          request.payload = serializeRequestData(msg.data);
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
            headers[k] = v!.toString();
          }
          return sendResponse({
            requestId: msg.requestId,
            status: res.statusCode,
            statusText: res.statusMessage,
            headers,
            data: res.payload ? JSON.parse(res.payload) : undefined,
          });
        }
      } catch (err) {
        if (err.response) {
          error(err);
          return sendResponse({
            requestId: msg.requestId,
            status: err.response.status,
            statusText: err.response.statusText,
            headers: err.response.headers,
            data: err.response.data,
          });
        } else {
          throw err;
        }
      }
      const parts =
        res.headers['content-location']?.toString().split('/') ?? [];
      let resourceId: string;
      let path_leftover = '';
      assert(parts.length >= 3);
      resourceId = `${parts[1]}/${parts[2]}`;
      if (parts.length > 3) {
        path_leftover = parts.slice(3).join('/');
      }
      if (path_leftover) {
        path_leftover = `/${path_leftover}`;
      }

      switch (msg.method) {
        case 'watch':
          trace('opening watch', msg.requestId);

          let watch = watches[resourceId];
          if (!watch) {
            // No existing WATCH on this resource
            watch = {
              handler: handleChange(resourceId),
              requests: { [msg.requestId]: path_leftover },
            };
            watches[resourceId] = watch;

            emitter.on(resourceId, watch.handler);
            socket.on('close', function handleClose() {
              emitter.removeListener(resourceId, watch!.handler);
            });
          } else {
            // Already WATCHing this resource
            watch.requests[msg.requestId] = path_leftover;
          }

          // Emit all new changes from the given rev in the request
          if (request.headers?.['x-oada-rev'] !== undefined) {
            trace('Setting up watch on:', resourceId);
            trace(
              'RECEIVED THIS REV:',
              resourceId,
              request.headers['x-oada-rev']
            );
            const rev = await resources.getResource(resourceId, '_rev');
            const revInt = parseInt((rev as unknown) as string);
            // If the requested rev is behind by revLimit, simply
            // re-GET the entire resource
            trace('REVS:', resourceId, rev, request.headers['x-oada-rev']);
            if (
              revInt - parseInt(request.headers['x-oada-rev'] as string) >=
              revLimit
            ) {
              trace(
                'REV WAY OUT OF DATE',
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
                'REV NOT TOO OLD...',
                resourceId,
                rev,
                request.headers['x-oada-rev']
              );
              // Next, feed changes to client
              const reqRevInt = parseInt(
                request.headers['x-oada-rev'] as string
              );
              for (let sendRev = reqRevInt + 1; sendRev <= revInt; sendRev++) {
                trace(
                  `Sending change ${sendRev} to resumed WATCH ${msg.requestId}`
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

        case 'delete':
          if (parts.length === 3) {
            // it is a resource
            emitter.removeAllListeners(resourceId);
          }
        default:
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            // @oada/client gets very angry if a header is anything but a string
            headers[k] = v!.toString();
          }
          sendResponse({
            requestId: msg.requestId,
            status: res.statusCode,
            headers,
            // TODO: Fix this?
            data: res.payload ? JSON.parse(res.payload) : undefined,
          });
      }
    }
  });
};

const writeResponder = new Responder({
  consumeTopic: config.get('kafka.topics.httpResponse') as string,
  group: 'websockets',
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
    trace('Emitted change for:', req.resource_id, change);
    emitter.emit(req.resource_id, {
      path_leftover: req.path_leftover,
      change,
    });
    if (change?.[0]?.type === 'delete') {
      trace(
        'Delete change received for:',
        req.resource_id,
        req.path_leftover,
        change
      );
      if (req.resource_id && req.path_leftover === '') {
        trace('Removing all listeners to:', req.resource_id);
        emitter.removeAllListeners(req.resource_id);
      }
    }
  } catch (e) {
    error(e);
  }
});

export default plugin;
