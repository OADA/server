/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { config } from './config.js';

import { strict as assert } from 'node:assert';
import { promisify } from 'node:util';

import { EventEmitter } from 'eventemitter3';
import type { FastifyPluginAsync } from 'fastify';
import type LightMyRequest from 'light-my-request';
import type WebSocket from 'ws';
import fastifyWebsocket from '@fastify/websocket';
import { is } from 'type-is';
import log from 'debug';

import { OADAError } from '@oada/error';

import { changes, resources } from '@oada/lib-arangodb';
import type { KafkaBase } from '@oada/lib-kafka';
import { Responder } from '@oada/lib-kafka';

import type Change from '@oada/types/oada/change/v2.js';
import type SocketChange from '@oada/types/oada/websockets/change.js';
import type SocketRequest from '@oada/types/oada/websockets/request.js';
import type SocketResponse from '@oada/types/oada/websockets/response.js';
import type { WriteResponse } from '@oada/write-handler';
import {
  // Runtime check for request type
  assert as assertRequest,
} from '@oada/types/oada/websockets/request.js';

/**
 * @todo Actually figure out how "forgetting history" should work...
 */
const revLimit = Number.POSITIVE_INFINITY;

const info = log('websockets:info');
const error = log('websockets:error');
const warn = log('websockets:warn');
const debug = log('websockets:debug');
const trace = log('websockets:trace');

const emitter = new EventEmitter<string, { change: Change }>();

class Watch {
  /**
   * @description Set of `requestId`s
   */
  readonly requests = new Set<string>();
  readonly resourceId;

  readonly #send;
  readonly #cb;

  constructor(resourceId: string, socket: WebSocket) {
    this.#send = promisify(socket.send.bind(socket));
    this.resourceId = resourceId;

    // eslint-disable-next-line no-constructor-bind/no-constructor-bind
    this.#cb = this.#handler.bind(this);
    emitter.on(resourceId, this.#cb);
    socket.on('close', () => {
      this.stop();
    });
  }

  stop() {
    emitter.removeListener(this.resourceId, this.#cb);
  }

  async sendChange(change: SocketChange) {
    trace({ change }, 'Sending change');
    // HACK: for backwards compatibility with older clients
    change.path_leftover ??= change.requestId.map(() => '');
    await this.#send(JSON.stringify(change));
  }

  #handler({ change }: { change: Change }): void {
    const { resourceId, requests } = this;
    debug('responding watch %s', resourceId);

    const message = {
      resourceId,
      change,
      requestId: Array.from(requests) as [string, ...string[]],
    };

    void this.sendChange(message);
  }
}

function parseRequest(data: WebSocket.Data): SocketRequest {
  // Assert(typeof data === 'string');
  // eslint-disable-next-line @typescript-eslint/no-base-to-string
  const message: unknown = JSON.parse(data.toString());

  // Assert type
  assertRequest(message);

  // Normalize header name capitalization
  const headers = message.headers ?? {};
  for (const header of Object.keys(headers)) {
    headers[header.toLowerCase()] = headers[header];
  }

  return { ...message, headers };
}

const plugin: FastifyPluginAsync = async (fastify) => {
  await fastify.register(fastifyWebsocket);

  fastify.get('/*', { websocket: true }, ({ socket }) => {
    /**
     * Awaitable function to send over socket
     */
    const send = promisify(socket.send.bind(socket));
    // Add our state stuff?
    let isAlive = true;
    const watches = new Map<string, Watch>();

    // Set up periodic ping/pong and timeout on socket
    const interval = setInterval(() => {
      if (!isAlive) {
        socket.terminate();
        return;
      }

      isAlive = false;
      socket.ping();
    }, 30_000);
    socket.on('pong', () => {
      isAlive = true;
    });
    socket.on('close', () => {
      clearInterval(interval);
    });

    async function sendResponse({
      payload,
      ...resp
    }: SocketResponse & { payload?: string }) {
      debug(resp, 'Responding to request');
      // TODO: Remove this hack...
      const string = JSON.stringify(resp);
      await (payload
        ? send(`${string.slice(0, -1)},"data":${payload}}`)
        : send(string));
    }

    // Handle request
    socket.on('message', async (data) => {
      let message: SocketRequest;
      try {
        message = parseRequest(data);
      } catch (cError: unknown) {
        const errorResponse: SocketResponse = {
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
            undefined,
            cError as string,
          ) as unknown as Record<string, unknown>,
        };
        error({ error: cError });
        await sendResponse(errorResponse);
        return;
      }

      try {
        await handleRequest(message);
      } catch (cError: unknown) {
        error({ error: cError, message }, 'Request handling error');
        const errorResponse = {
          status: 500,
          requestId: message.requestId,
          headers: {},
          data: new OADAError('Internal Error', 500) as unknown as Record<
            string,
            unknown
          >,
        };
        await sendResponse(errorResponse);
      }
    });

    async function handleRequest(message: SocketRequest) {
      info(
        'Handling socket req %s: %s %s',
        message.requestId,
        message.method,
        message.path,
      );
      trace(message);

      const request: LightMyRequest.InjectOptions = {
        url: message.path,
        headers: {
          // Pass requestId along to main code for easier tracking
          'X-Request-ID': message.requestId,
          ...message.headers,
        },
      };
      switch (message.method) {
        case 'ping': {
          debug('ping');
          // Send an empty response
          await sendResponse({
            requestId: message.requestId,
            status: 204, // HTTP 204: No Content
          });
          return;
        }

        case 'unwatch': {
          debug('closing watch', message.requestId);

          // Find corresponding WATCH
          let found = false;
          for (const [resource, watch] of watches) {
            if (!watch.requests.has(message.requestId)) {
              continue;
            }

            watch.requests.delete(message.requestId);
            if (watch.requests.size === 0) {
              // No watches on this resource left
              watches.delete(resource);
              watch.stop();
            }

            found = true;
            break;
          }

          if (!found) {
            warn('Received UNWATCH for unknown WATCH %s', message.requestId);
          }

          await sendResponse({
            requestId: message.requestId,
            status: 200,
          });

          // No actual request to make for UNWATCH
          return;
        }

        case 'watch': // Standard watch it just a HEAD
        case 'head-watch': {
          request.method = 'head';
          break;
        }

        case 'get-watch': {
          request.method = 'get';
          break;
        }

        case 'put-watch': {
          request.method = 'put';
          break;
        }

        case 'post-watch': {
          request.method = 'post';
          break;
        }

        case 'delete-watch': {
          request.method = 'delete';
          break;
        }

        default: {
          request.method = message.method;
          break;
        }
      }

      request.payload = JSON.stringify(message.data);

      let response: LightMyRequest.Response;
      try {
        response = await fastify.inject(request);
        // Treat any status above 2xx as error?
        if (response.statusCode >= 300) {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(response.headers)) {
            // @oada/client gets very angry if a header is anything but a string
            if (v) {
              headers[k] = v.toString();
            }
          }

          await sendResponse({
            requestId: message.requestId,
            status: response.statusCode,
            statusText: response.statusMessage,
            headers,
            payload: response.payload,
          });
          return;
        }
      } catch (cError: unknown) {
        if (cError && typeof cError === 'object' && 'response' in cError) {
          error({ error: cError });
          const {
            response: { status, statusText, headers, data },
          } = cError as {
            response: {
              status: number;
              statusText: string;
              headers: Record<string, string>;
              data: Record<string, unknown>;
            };
          };
          await sendResponse({
            requestId: message.requestId,
            status,
            statusText,
            headers,
            data,
          });
          return;
        }

        throw cError;
      }

      const parts =
        response.headers['content-location']?.toString().split('/') ?? [];
      let pathLeftover = '';
      assert(parts.length >= 3);
      const resourceId = `${parts[1]!}/${parts[2]!}`;
      if (parts.length > 3) {
        pathLeftover = parts.slice(3).join('/');
      }

      pathLeftover &&= `/${pathLeftover}`;

      switch (message.method) {
        case 'head-watch':
        case 'get-watch':
        case 'put-watch':
        case 'post-watch':
        case 'delete-watch':
        case 'watch': {
          debug('opening watch %s', message.requestId);

          const watch =
            watches.get(resourceId) ?? new Watch(resourceId, socket);
          watch.requests.add(message.requestId);
          watches.set(resourceId, watch);

          // Emit all new changes from the given rev in the request
          const revHeader = request.headers?.['x-oada-rev'];
          trace('Received this rev: %s %s', resourceId, revHeader);
          const headerRev = Number.parseInt(revHeader as string, 10);
          if (Number.isNaN(headerRev)) {
            // Emit no changes, just set a WATCH
            break;
          }

          debug('Setting up watch on: %s', resourceId);
          const rev = await resources.getResource(resourceId, '/_rev');
          const revInt = Number.parseInt(rev as unknown as string, 10);
          // If the requested rev is behind by revLimit, simply
          // re-GET the entire resource
          trace('REVS: %s %s %s', resourceId, rev, headerRev);
          if (revInt - headerRev >= revLimit) {
            trace('REV WAY OUT OF DATE %s: %s %s', resourceId, rev, headerRev);
            const resource = await resources.getResource(resourceId);
            await sendResponse({
              requestId: message.requestId,
              resourceId,
              resource,
              status: 200,
            });
          } else {
            // First, declare success.
            await sendResponse({
              requestId: message.requestId,
              status: 200,
            });
            trace('REV NOT TOO OLD %s: %s %s', resourceId, rev, headerRev);
            // Next, feed changes to client
            for (let sendRev = headerRev + 1; sendRev <= revInt; sendRev++) {
              trace(
                'Sending change %s to resumed WATCH %s',
                sendRev,
                message.requestId,
              );
              // eslint-disable-next-line no-await-in-loop
              const change = await changes.getChangeArray(resourceId, sendRev);
              // eslint-disable-next-line no-await-in-loop
              await watch.sendChange({
                requestId: [message.requestId],
                resourceId,
                change,
              });
            }
          }

          break;
        }

        default: {
          break;
        }
      }

      switch (message.method) {
        case 'delete-watch':
        case 'delete': {
          if (parts.length === 3) {
            // It is a resource
            emitter.removeAllListeners(resourceId);
          }
        }

        // eslint-disable-next-line no-fallthrough
        case 'get-watch':
        case 'get': {
          // Can only send JSON over websockets
          const type = response.headers['content-type']?.toString();
          if (type && !is(type, ['json', '+json'])) {
            const headers: Record<string, string> = {};
            for (const [k, v] of Object.entries(response.headers)) {
              if (v) {
                headers[k] = v.toString();
              }
            }

            await sendResponse({
              requestId: message.requestId,
              // Bad Request
              status: 400,
              statusText: 'Cannot GET binary over WebSockets',
              headers,
            });
            return;
          }
        }

        // eslint-disable-next-line no-fallthrough
        default: {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(response.headers)) {
            // @oada/client gets very angry if a header is anything but a string
            if (v) {
              headers[k] = v.toString();
            }
          }

          await sendResponse({
            requestId: message.requestId,
            status: response.statusCode,
            headers,
            // TODO: why is there a payload for HEAD??
            payload: ['watch', 'head', 'head-watch'].includes(message.method)
              ? undefined
              : response.payload,
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

  /**
   * Listen for successful write requests to resources of interest, then emit an event
   */
  writeResponder.on('request', async (request) => {
    if (!checkRequest(request)) {
      return;
    }

    /**
     * TODO: Fix this check for when parents have listeners?
    if (emitter.listeners(request.resource_id).length === 0) {
      // No WATCHes
      return;
    }
    */

    try {
      const change = await changes.getChangeArray(
        request.resource_id,
        request._rev,
      );
      trace({ change }, `Emitted change for ${request.resource_id}`);
      emitter.emit(request.resource_id, {
        change,
      });
      if (change?.[0]?.type === 'delete') {
        trace({ change }, 'Delete change received');
        if (request.resource_id && request.path_leftover === '') {
          debug('Removing all listeners to: %s', request.resource_id);
          emitter.removeAllListeners(request.resource_id);
        }
      }
    } catch (cError: unknown) {
      error({ error: cError });
    }
  });
};

function checkRequest(request: KafkaBase): request is WriteResponse {
  return request.msgtype === 'write-response' && request.code === 'success';
}

export default plugin;
