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

const path = require('path');

const debug = require('debug')('model-tokens');
const OADAError = require('oada-error');

const config = require('../../config');
const db = require(// nosemgrep: detect-non-literal-require
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
    } else {
      return true;
    }
  };

  token.isExpired = function () {
    return this.createTime + this.expiresIn < new Date().getTime();
  };

  return token;
}

function findByToken(token, cb) {
  db.findByToken(token, function (err, t) {
    var token;
    if (t) {
      token = makeToken(t);
    }

    cb(err, token);
  });
}

function save(t, cb) {
  var token;

  if (t.isValid === undefined) {
    token = makeToken(t);
  } else {
    token = t;
  }

  token.scope = token.scope || [];

  if (!token.isValid()) {
    return cb(new Error('Invalid token'));
  }

  findByToken(token.token, function (err, t) {
    if (err) {
      debug(err);
      return cb(err);
    }

    if (t) {
      return cb(
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

    token.createTime = new Date().getTime();

    debug('save: saving token ', token);
    db.save(token, function (err) {
      if (err) {
        debug(err);
        return cb(err);
      }

      findByToken(token.token, cb);
    });
  });
}

module.exports = {
  findByToken: findByToken,
  save: save,
};
