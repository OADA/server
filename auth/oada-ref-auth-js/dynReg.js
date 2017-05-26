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

var keys = require('./keys');
var trustedJws = require('oada-trusted-jws');
var clients = require('./db/models/client');
var config = require('./config');
var debug = require('debug')('error');

function dynReg(req, res, done) {

  if(!req.body || !req.body.software_statement) {
    res.status(400).json({
      error: 'invalid_client_metadata',
      error_description: 'Client metadata must include a valid trusted OADA'
    });

    return done();
  }

  trustedJws(req.body.software_statement, {
    timeout: config.get('auth:dynamicRegistration:trustedListLookupTimeout')
  }).spread(function(trusted, metadata) {
      metadata.trusted = trusted;

      if(!metadata.contacts || !metadata.client_name ||
         !metadata.redirect_uris) {
        res.status(400).json({
          error: 'invalid_software_statement',
          error_description: 'Software statement must include at least ' +
                             'client_name, redirect_uris, and contacts'
        });

        return done();
      }

      clients.save(metadata, function(err, client) {
        if(err) {
          debug('Failed to save new dynReg client.  err = ', err);
          res.status(400).json({
            error: 'invalid_client_metadata',
            error_description: 'Unexpected error - Metadata could not be stored'
          });

          return done();
        }

        metadata.client_id = client.clientId;
        delete metadata.clientId;

        res.status(201).json(metadata);
      });
    })
    .catch(function(e) {
      console.log(e.stack);
      res.status(400).json({
        error: 'invalid_software_statement',
        error_description: 'Software statement is malformed'
      });

      return done();
    });
};

module.exports = dynReg;
