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

'use strict';

const path = require('path');

const debug = require('debug')('model-tokens');
const OADAError = require('oada-error');

const config = require('../../config');
const database = require(// Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
path.join(
  __dirname,
  '/../../db',
  config.get('auth.datastoresDriver'),
  'tokens.js'
));

function makeToken(token) {
  token.isValid = function () {
    if (
      typeof token.token !== 'string' ||
      !Array.isArray(token.scope) ||
      typeof token.user !== 'object' ||
      typeof token.clientId != 'string'
    ) {
      return false;
    }

    return true;
  };

  token.isExpired = function () {
    return this.createTime + this.expiresIn < Date.now();
  };

  return token;
}

function findByToken(token, callback) {
  database.findByToken(token, (error, t) => {
    let token;
    if (t) {
      token = makeToken(t);
    }

    callback(error, token);
  });
}

function save(t, callback) {
  let token;

  token = t.isValid === undefined ? makeToken(t) : t;

  token.scope = token.scope || [];

  if (!token.isValid()) {
    return callback(new Error('Invalid token'));
  }

  findByToken(token.token, (error, t) => {
    if (error) {
      debug(error);
      return callback(error);
    }

    if (t) {
      return callback(
        new OADAError(
          'Token already exists',
          OADAError.codes.BAD_REQUEST,
          'There was a problem login in'
        )
      );
    }

    if (typeof token.expiresIn !== 'number') {
      token.expiresIn = 60;
    }

    token.createTime = Date.now();

    debug('save: saving token ', token);
    database.save(token, (error) => {
      if (error) {
        debug(error);
        return callback(error);
      }

      findByToken(token.token, callback);
    });
  });
}

module.exports = {
  findByToken,
  save,
};
