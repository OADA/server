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

const _ = require('lodash')
var keys = require('./keys')
var oadacerts = require('@oada/oada-certs')
var Promise = require('bluebird')
var clients = Promise.promisifyAll(require('./db/models/client'))
var config = require('./config')
var debug = require('debug')

const error = debug('oada-ref-auth#dynReg:error')
const info = debug('oada-ref-auth#dynReg:info')
const trace = debug('oada-ref-auth#dynReg:trace')

function dynReg (req, res) {
  return Promise.try(function () {
    if (!req.body || !req.body.software_statement) {
      info(
        'request body does not have software_statement key.  Did you remember content-type=application/json?  Body = ',
        req.body
      )
      res.status(400).json({
        error: 'invalid_client_registration_body',
        error_description:
          'POST to Client registration must include a software_statement in the body'
      })
      return
    }

    return oadacerts
      .validate(req.body.software_statement, {
        timeout: config.get('auth:dynamicRegistration:trustedListLookupTimeout')
      })
      .then(({ clientcert, trusted, valid, details }) => {
        if (typeof clientcert === 'string') {
          clientcert = JSON.parse(clientcert)
        }
        // Set the "trusted" status based on JWS library return value
        clientcert.trusted = trusted
        clientcert.valid = valid

        // Must have contacts, client_name, and redirect_uris or we won't save it
        if (
          !clientcert.contacts ||
          !clientcert.client_name ||
          !clientcert.redirect_uris
        ) {
          res.status(400).json({
            error: 'invalid_software_statement',
            error_description:
              'Software statement must include at least client_name, redirect_uris, and contacts'
          })
          return
        }

        if (!valid) {
          res.status(400).json({
            error: 'invalid_software_statement',
            error_description:
              'Software statement was not a valid JWT.  Details on rejection = ' +
              JSON.stringify(details, false, '  ')
          })
          return
        }

        // If scopes is listed in the body, check them to make sure they are in the software_statement, then
        // replace the signed ones with the subset given in the body
        if (req.body.scopes && typeof scopes === 'string') {
          const possiblescopes = _.split(clientcert.scopes || '', ' ')
          const subsetscopes = _.split(req.body.scopes)
          const finalscopes = _.filter(subsetscopes, s =>
            _.find(possiblescopes, s)
          )
          clientcert.scopes = _.join(finalscopes, ' ')
        }

        //------------------------------------------
        // Save client to database, return client_id for their future OAuth2 requests
        trace(
          'Saving client ' +
            clientcert.client_name +
            ' registration, trusted = ',
          trusted
        )
        return clients
          .saveAsync(clientcert)
          .then(function (client) {
            clientcert.client_id = client.clientId
            delete clientcert.clientId
            info(
              'Saved new client ID ' +
                clientcert.client_id +
                ' to DB, client_name = ',
              clientcert.client_name
            )
            res.status(201).json(clientcert)
          })
          .catch(function (err) {
            error('Failed to save new dynReg client.  err = ', err)
            res.status(400).json({
              error: 'invalid_client_registration',
              error_description:
                'Unexpected error - Client registration could not be stored.  Err = ' +
                err.toString()
            })
          })

        // If oadacerts fails
      })
      .catch(function (e) {
        error(
          'Failed to validate client registration, oada-certs threw error: ',
          e
        )
        res.status(400).json({
          error: 'invalid_client_registration',
          error_description:
            'Client registration failed decoding or had invalid signature.'
        })
      })
  })
}

// Add a test fixture to mock the database:
dynReg.test = {
  mockClientsDatabase: function (mockdb) {
    clients = mockdb
  },
  oadacerts
}

module.exports = dynReg
