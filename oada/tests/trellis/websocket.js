/**
 * @license
 * Copyright 2021 Open Ag Data Alliance
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
const Promise = require('bluebird');
const { v4: uuid } = require('uuid');
const WebSocket = require('ws');

function websocket(url) {
  // Create the message queue
  let messages = [];
  // Create the socket
  url = url.replace('https://', 'wss://').replace('http://', 'ws://');
  //	Url = url.indexOf('ws') !== 0 ? url + 'wss://' : url;
  const socket = new WebSocket(url);
  let connected = false;
  let httpCallbacks = {};
  let watchCallbacks = {};

  function sendMessages() {
    if (!connected) return;
    for (const message of messages) {
      socket.send(JSON.stringify(message));
    }

    messages = [];
  }

  return new Promise((resolve, _reject) => {
    socket.addEventListener('open', () => {
      connected = true;
      sendMessages();
      resolve(socket);
    });

    socket.on('open', socket.onopen);

    socket.addEventListener('close', () => {});
    socket.on('close', socket.onclose);
    socket.onmessage = function (event) {
      const response = JSON.parse(event.data);
      // Look for id in httpCallbacks
      if (response.requestId) {
        if (httpCallbacks[response.requestId]) {
          // Resolve Promise
          if (response.status >= 200 && response.status < 300) {
            httpCallbacks[response.requestId].resolve(response);
          } else {
            // Create error like axios
            const error = new Error(
              `Request failed with status code ${response.status}`,
            );
            error.request = httpCallbacks[response.requestId].request;
            error.response = {
              status: response.status,
              statusText: response.data.title,
              headers: response.headers,
              data: response.data,
            };
            httpCallbacks[response.requestId].reject(error);
          }

          delete httpCallbacks[response.requestId];
        } else if (watchCallbacks[response.requestId]) {
          if (watchCallbacks[response.requestId].resolve) {
            if (response.status === 'success') {
              // Successfully setup websocket, resolve promise
              watchCallbacks[response.requestId].resolve(response);
            } else {
              const error = new Error(
                `Request failed with status code ${response.status}`,
              );
              error.response = response;
              watchCallbacks[response.requestId].reject(error);
            }

            // Remove resolve and reject so we process change as a signal next time
            delete watchCallbacks[response.requestId].resolve;
            delete watchCallbacks[response.requestId].reject;
          } else {
            if (watchCallbacks[response.requestId].callback == undefined)
              throw new Error(
                'The given watch function has an undefined callback:',
                watchCallbacks[response.requestId],
              );
            watchCallbacks[response.requestId].callback(response);
          }
        }
      }
    };

    socket.on('message', socket.onclose);
  }).then(() => {
    function _http(request) {
      // Do a HTTP request
      return new Promise((resolve, reject) => {
        if (request.url.indexOf(url) === 0)
          request.url = request.url.replace(url, '');
        const message = {
          requestId: uuid(),
          method: request.method.toLowerCase(),
          path: request.url,
          data: request.data,
          headers: Object.entries(request.headers)
            .map(([key, value]) => ({ [key.toLowerCase()]: value }))
            .reduce((a, b) => ({ ...a, ...b })),
        };
        messages.push(message);
        httpCallbacks[message.requestId] = {
          request,
          resolve,
          reject,
        };
        sendMessages();
      });
    }

    function _watch(request, callback) {
      // Watch for changes on requested resource and trigger provided signal
      return new Promise((resolve, reject) => {
        const message = {
          requestId: uuid(),
          method: 'watch',
          path: request.url,
          headers: Object.entries(request.headers)
            .map(([key, value]) => ({ [key.toLowerCase()]: value }))
            .reduce((a, b) => ({ ...a, ...b })),
        };
        messages.push(message);
        watchCallbacks[message.requestId] = { resolve, reject, callback };
        sendMessages();
      });
    }

    function _close() {
      // TODO reject all callbacks that have not resolved
      // Clear everything
      messages = [];
      httpCallbacks = {};
      watchCallbacks = {};
      // Close socket
      socket.close();
    }

    return {
      url,
      http: _http,
      close: _close,
      watch: _watch,
    };
  });
}

module.exports = websocket;
