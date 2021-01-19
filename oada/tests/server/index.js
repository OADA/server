/* eslint no-console: 0 */
'use strict'

const express = require('express')
const debug = require('debug')
const error = debug('oada-srvc-tests:server:error')
const info = debug('oada-srvc-tests:server:info')
const trace = debug('oada-srvc-tests:server:trace')

const port = process.env.PORT || 80
const ip = process.env.IP || 'localhost'
const app = (module.exports = express())

const FOO_TOKEN = 'footoken'

// Echo.
const echo = '/echo'
app.get(echo, (req, res) => {
  info('Echo request recieved!')
  let attachedToken = req.headers.authorization
  info('  - Attached token info: ' + attachedToken)
  res.send('Echo page received request: ' + req)
})

// Run the server.
app.listen(port, ip, function onStart (err) {
  if (err) {
    error(err)
  }
  info(
    '==> 🌎 Listening on port %s. Open up http://%s:%s/ in your browser.',
    port,
    ip,
    port
  )
})
