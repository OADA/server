/* eslint no-console: 0 */
'use strict'

const express = require('express');

const port = process.env.PORT || 80;
const ip = process.env.IP || 'localhost';
const app = module.exports = express();

const FOO_TOKEN = 'footoken';

// Echo.
const echo = '/echo';
app.get(echo, (req, res) => {
  console.info('Echo request recieved!');
  let attachedToken = req.headers.authorization;
  console.info('  - Attached token info: ' + attachedToken);
  res.send('Echo page received request: ' + req);
})

// Run the server.
app.listen(port, ip, function onStart(err) {
  if (err) {
    console.log(err);
  }
  console.info(
    '==> 🌎 Listening on port %s. Open up http://%s:%s/ in your browser.',
    port, ip, port);
});
