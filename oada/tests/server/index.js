/* eslint no-console: 0 */
'use strict';

const express = require('express');
const debug = require('debug');
const error = debug('oada-srvc-tests:server:error');
const info = debug('oada-srvc-tests:server:info');

const port = process.env.PORT || 80;
const ip = process.env.IP || 'localhost';
const app = (module.exports = express());

// Echo.
const echo = '/echo';
app.get(echo, (request, res) => {
  info('Echo request recieved!');
  const attachedToken = request.headers.authorization;
  info(`  - Attached token info: ${attachedToken}`);
  res.send(`Echo page received request: ${request}`);
});

// Run the server.
app.listen(port, ip, function onStart(error_) {
  if (error_) {
    error(error_);
  }

  info(
    '==> 🌎 Listening on port %s. Open up http://%s:%s/ in your browser.',
    port,
    ip,
    port
  );
});
