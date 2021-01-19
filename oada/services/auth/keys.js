/* Copyright 2014 Open Ag Data Alliance
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
'use strict'

var fs = require('fs')
var path = require('path')
var rsaPemToJwk = require('rsa-pem-to-jwk')

var config = require('./config')

/*
 * Loadis in all PEM files at config.keys.signPems to sign IdTokens with. The
 * PEMs filename (minus the .pem extension) becomes the key id.
 */
// Initialize the keys objects
var keys = {
  jwks: {
    keys: []
  },
  sign: {}
}

// Load in all PEM files
var files = fs.readdirSync(config.get('auth:keys:signPems'))
for (var i = 0; i < files.length; i++) {
  if (path.extname(files[i]).toLowerCase() === '.pem') {
    var pem = fs.readFileSync(
      path.join(config.get('auth:keys:signPems'), files[i])
    )

    var kid = path.basename(files[i], '.pem')
    var jwkExtras = {
      alg: 'RS256',
      use: 'sig',
      kid: kid
    }
    var jwk = rsaPemToJwk(pem, jwkExtras, 'public')

    // Make sure PEM is valid
    if (jwk !== undefined) {
      keys.jwks.keys.push(jwk)
      keys.sign[kid] = {
        kty: 'PEM',
        alg: 'RS256',
        use: 'sig',
        kid: kid,
        pem: pem
      }
    }
  }
}

module.exports = keys
