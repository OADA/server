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

const debug = require('debug')('model-codes:trace');
const URI = require('urijs');

const OADAError = require('oada-error');
const config = require('../../config');
const path = require('path');
const database = require(// Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
path.join(
  __dirname,
  '/../../db',
  config.get('auth.datastoresDriver'),
  'codes.js'
));

function makeCode(code) {
  code.isValid = function () {
    if (
      typeof code.code !== 'string' ||
      !Array.isArray(code.scope) ||
      typeof code.user !== 'object' ||
      typeof code.clientId != 'string' ||
      typeof code.redirectUri != 'string'
    ) {
      return false;
    }

    return true;
  };

  code.isExpired = function () {
    return this.createTime + this.expiresIn > Date.now();
  };

  code.matchesClientId = function (clientId) {
    return this.clientId === clientId;
  };

  code.matchesRedirectUri = function (redirectUri) {
    return URI(this.redirectUri).equals(redirectUri);
  };

  code.isRedeemed = function () {
    return this.redeemed;
  };

  code.redeem = function (callback) {
    const self = this;
    this.redeemed = true;

    debug('makeCode#redeem: saving redeemed code ', self.code);
    database.save(this, (error) => {
      if (error) {
        debug(error);
        return callback(error);
      }

      findByCode(self.code, callback);
    });
  };

  return code;
}

function findByCode(code, callback) {
  database.findByCode(code, (error, c) => {
    let code;
    if (c === undefined) {
      error = 'Code not found';
    }

    if (!error) {
      code = makeCode(c);
    }

    callback(error, code);
  });
}

function save(c, callback) {
  let code;

  code = c.isValid === undefined ? makeCode(c) : c;

  code.scope = code.scope || {};

  if (!code.isValid()) {
    return callback(
      new OADAError(
        'Invalid code',
        OADAError.codes.BAD_REQUEST,
        'There was a problem durring the login'
      )
    );
  }

  database.findByCode(code.code, (error, c) => {
    if (error) {
      debug(error);
      return callback(error);
    }

    if (c) {
      return callback(
        new OADAError(
          'Code already exists',
          OADAError.codes.BAD_REQUEST,
          'There was a problem durring the login'
        )
      );
    }

    if (typeof code.expiresIn !== 'number') {
      code.expiresIn = 60;
    }

    code.createTime = Date.now();
    code.redeemed = false;

    database.save(code, (error) => {
      if (error) {
        debug(error);
        return callback(error);
      }

      findByCode(code.code, callback);
    });
  });
}

module.exports = {
  findByCode,
  save,
};
