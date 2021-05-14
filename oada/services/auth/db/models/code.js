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

var debug = require('debug')('model-codes:trace');
var URI = require('urijs');

var OADAError = require('oada-error');
var config = require('../../config');
var path = require('path');
var db = require(// nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
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
    } else {
      return true;
    }
  };

  code.isExpired = function () {
    return this.createTime + this.expiresIn > new Date().getTime();
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

  code.redeem = function (cb) {
    var self = this;
    this.redeemed = true;

    debug('makeCode#redeem: saving redeemed code ', self.code);
    db.save(this, function (err) {
      if (err) {
        debug(err);
        return cb(err);
      }

      findByCode(self.code, cb);
    });
  };

  return code;
}

function findByCode(code, cb) {
  db.findByCode(code, function (err, c) {
    var code;
    if (c === undefined) {
      err = 'Code not found';
    }

    if (!err) {
      code = makeCode(c);
    }

    cb(err, code);
  });
}

function save(c, cb) {
  var code;

  if (c.isValid === undefined) {
    code = makeCode(c);
  } else {
    code = c;
  }

  code.scope = code.scope || {};

  if (!code.isValid()) {
    return cb(
      new OADAError(
        'Invalid code',
        OADAError.codes.BAD_REQUEST,
        'There was a problem durring the login'
      )
    );
  }

  db.findByCode(code.code, function (err, c) {
    if (err) {
      debug(err);
      return cb(err);
    }

    if (c) {
      return cb(
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

    code.createTime = new Date().getTime();
    code.redeemed = false;

    db.save(code, function (err) {
      if (err) {
        debug(err);
        return cb(err);
      }

      findByCode(code.code, cb);
    });
  });
}

module.exports = {
  findByCode: findByCode,
  save: save,
};
