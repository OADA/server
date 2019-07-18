#!/usr/bin/env node
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

var path = require('path');
var mongojs = require('mongojs');
var bcrypt = require('bcryptjs');
var config = require('../../config');

if (process.argv.length < 3) {
  console.log('Useage: ' + process.argv[0] + ' ' +
      path.basename(process.argv[1]) + ' mongoConnectionString ' +
      '[--no-example-data]');
  process.exit(1);
}
var importData = (process.argv[3] !== '--no-example-data') ? true : false;

/////
// CLIENTS
/////
var clientsDb = mongojs(process.argv[2], ['clients']);

// Create clients indexes
clientsDb.clients.ensureIndex({clientId: 1}, {unique: true}, function(err) {
  if (err) { console.log(err); process.exit(); }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    var clients = require('../flat/clients.json');
    var mongoClients = Object.keys(clients).map(function(key) {
      return clients[key];
    });

    clientsDb.clients.insert(mongoClients, function(err) {
      if (err) { console.log(err); }

      clientsDb.close();
    });
  } else {
    clientsDb.close();
  }
});

/////
// USERS
/////
var usersDb = mongojs(process.argv[2], ['users']);

// Create clients indexes
usersDb.users.ensureIndex({username: 1}, {unique: true}, function(err) {
  if (err) { console.log(err); process.exit(); }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    var users = require('../flat/users.json');
    var mongoUsers = Object.keys(users).map(function(key) {
      var t = users[key];
      delete t.id;
      t.password = bcrypt.hashSync(t.password, config.server.passwordSalt);

      return t;
    });

    usersDb.users.insert(mongoUsers, function(err) {
      if (err) { console.log(err); }

      usersDb.close();
    });
  } else {
    usersDb.close();
  }
});

/////
// CODES
/////
var codesDb = mongojs(process.argv[2], ['codes']);

// Create clients indexes
codesDb.codes.ensureIndex({code: 1}, {unique: true}, function(err) {
  if (err) { console.log(err); process.exit(); }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    var codes = require('../flat/codes.json');
    var mongoCodes = Object.keys(codes).map(function(key) {
      var t = codes[key];
      delete t.id;

      return t;
    });

    codesDb.codes.insert(mongoCodes, function(err) {
      if (err) { console.log(err); }

      codesDb.close();
    });
  } else {
    codesDb.close();
  }
});

/////
// TOKENS
/////
var tokensDb = mongojs(process.argv[2], ['tokens']);

// Create clients indexes
tokensDb.tokens.ensureIndex({token: 1}, {unique: true}, function(err) {
  if (err) { console.log(err); process.exit(); }

  // Add example data, unless not requested
  if (importData) {
    // Populate example clients
    var tokens = require('../flat/tokens.json');
    var mongoTokens = Object.keys(tokens).map(function(key) {
      var t = tokens[key];
      delete t.id;

      return t;
    });

    tokensDb.tokens.insert(mongoTokens, function(err) {
      if (err) { console.log(err); }

      tokensDb.close();
    });
  } else {
    tokensDb.close();
  }
});
