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
'use strict';

const _ = require('lodash');
var keys = require('./keys');
var oadaTrustedJWS = require('oada-trusted-jws');
var Promise = require('bluebird');
var clients = Promise.promisifyAll(require('./db/models/client'));
var config = require('./config');
var debug = require('debug');

const error = debug('oada-ref-auth#dynReg:error');
const info = debug('oada-ref-auth#dynReg:info');
const trace = debug('oada-ref-auth#dynReg:trace');

function dynReg(req, res) {
  return Promise.try(function() {
    if(!req.body || !req.body.software_statement) {
      info('request body does not have software_statement key');
      res.status(400).json({
        error: 'invalid_client_registration_body',
        error_description: 'POST to Client registration must include a software_statement in the body'
      });
      return;
    }
  
    return oadaTrustedJWS(req.body.software_statement, {
      timeout: config.get('auth:dynamicRegistration:trustedListLookupTimeout')
    }).spread(function(trusted, clientreg) {
      // Set the "trusted" status based on JWS library return value
      clientreg.trusted = trusted;
  
      // Must have contacts, client_name, and redirect_uris or we won't save it
      if(!clientreg.contacts || !clientreg.client_name || !clientreg.redirect_uris) {
        res.status(400).json({
          error: 'invalid_software_statement',
          error_description: 'Software statement must include at least client_name, redirect_uris, and contacts'
        });
        return;
      }

      // If scopes is listed in the body, check them to make sure they are in the software_statement, then
      // replace the signed ones with the subset given in the body
      if (req.body.scopes && typeof scopes === 'string') {
        const possiblescopes = _.split(clientreg.scopes || '', ' ');
        const subsetscopes = _.split(req.body.scopes);
        const finalscopes = _.filter(subsetscopes, s => _.find(possiblescopes, s));
        clientreg.scopes = _.join(finalscopes, ' ');
      }
  
      //------------------------------------------
      // Save client to database, return client_id for their future OAuth2 requests
      trace('Saving client '+clientreg.client_name+' registration, trusted = ', trusted);
      return clients.saveAsync(clientreg)
      .then(function(client) {
  
          clientreg.client_id = client.clientId;
          delete clientreg.clientId;
          info('Saved new client ID '+clientreg.client_id+' to DB, client_name = ', clientreg.client_name);  
          res.status(201).json(clientreg);
      }).catch(function (err) {
        error('Failed to save new dynReg client.  err = ', err);
        res.status(400).json({
          error: 'invalid_client_registration',
          error_description: 'Unexpected error - Client registration could not be stored.  Err = '+err.toString()
        });
      })
  
    // If trustedJWS fails
    }).catch(function(e) {
      error('Failed to validate client registration, oada-trusted-jws threw error: ', e);
      res.status(400).json({
        error: 'invalid_client_registration',
        error_description: 'Client registration failed decoding or had invalid signature.'
      });
    });
  });
};

// Add a test fixture to mock the database:
dynReg.test = {
  mockClientsDatabase: function(mockdb) { clients = mockdb; },
  oadaTrustedJWS,
};

module.exports = dynReg;
