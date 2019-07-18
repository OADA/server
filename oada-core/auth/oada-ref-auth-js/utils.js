/* Copyriggtht 2014 Open Ag Data Alliance
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

var crypto = require('crypto');

var TokenError = require('oauth2orize').TokenError;
var jwt = require('jsonwebtoken');
var objectAssign = require('object-assign');
var debug = require('debug')('utils:trace');

var config = require('./config');
var tokens = require('./db/models/token');
var codes = require('./db/models/code');
var keys = require('./keys');

function makeHash(length) {
  return crypto.randomBytes(Math.ceil(length * 3 / 4))
    .toString('base64')
    .slice(0, length)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// iss is the domain of the issuer that is handing out the token
function createIdToken(iss, aud, user, nonce, userinfoScope) {
  userinfoScope = userinfoScope || [];

  var idToken = config.get('auth:idToken');
  debug('createIdToken: creating token, kid = ', idToken.signKid, ', keys.sign = ', keys.sign);
  var options = {
    headers: {
      kid: idToken.signKid
    },
    algorithm: keys.sign[idToken.signKid].alg,
    expiresIn: idToken.expiresIn,
    audience: aud,
    subject: user.id,
    issuer: iss, 
  };

  var payload = {
    iat: new Date().getTime()
  };

  if (nonce !== undefined) {
    payload.nonce = nonce;
  }

  var userinfo = createUserinfo(user, userinfoScope);

  if (userinfo) {
    objectAssign(payload, userinfo);
  }

  debug('createIdToken: signing payload of id token');
  var j = jwt.sign(payload, keys.sign[idToken.signKid].pem, options);
  debug('createIdToken: done signing payload of id token');

  return j;
}

function createToken(scope, user, clientId, done) {
  var token = config.get('auth:token');
  var tok = {
    token: makeHash(token.length),
    expiresIn: token.expiresIn,
    scope: scope,
    user: user,
    clientId: clientId,
  };

  tokens.save(tok, done);
}

function createUserinfo(user, scopes) {
  var userinfo = {};

  if (scopes.indexOf('profile') != -1) {
    objectAssign(userinfo, {
      'sub': user.id,
      'name': user.name,
      'family_name': user['family_name'],
      'given_name': user['given_name'],
      'middle_name': user['middle_name'],
      'nickname': user.nickname,
      'preferred_username': user.username,
      'profile': user.profile,
      'picture': user.picture,
      'website': user.website,
      'gender': user.gender,
      'birthdate': user.birthdate,
      'zoneinfo': user.zoneinfo,
      'locale': user.locale,
      'updated_at': user['updated_at'],
    });
  }

  if (scopes.indexOf('email') != -1) {
    objectAssign(userinfo, {
      'sub': user.id,
      'email': user.email,
      'email_verified': user['email_verified'],
    });
  }

  if (scopes.indexOf('address') != -1) {
    objectAssign(userinfo, {
      'sub': user.id,
      'address': user.address,
    });
  }

  if (scopes.indexOf('phone') != -1) {
    objectAssign(userinfo, {
      'sub': user.id,
      'phone_number': user['phone_number'],
      'phone_number_verified': user['phone_number_verified'],
    });
  }

  if (userinfo.sub === undefined) {
    return undefined;
  } else {
    return userinfo;
  }
}

function issueToken(client, user, ares, done) {
  createToken(ares.scope, user, client.clientId, function(err, token) {
    if (err) { return done(err); }

    done(null, token.token, {'expires_in': token.expiresIn});
  });
}

function issueIdToken(client, user, ares, done) {
  var userinfoScope = ares.userinfo ? ares.scope : [];

  done(null, createIdToken(client.reqdomain, client.clientId, user, ares.nonce, userinfoScope));
}

function issueCode(client, redirectUri, user, ares, done) {
  var code = config.get('auth:code');
  var c = {
    code: makeHash(code.length),
    expiresIn: code.expiresIn,
    scope: ares.scope,
    user: user,
    clientId: client.clientId,
    redirectUri: redirectUri
  };

  if (ares.nonce) {
    c.nonce = ares.nonce;
  }

  debug('Saving new code: ', c.code);
  codes.save(c, function(err, code) {
    if (err) { return done(err); }

    done(null, code.code);
  });
}

function issueTokenFromCode(client, c, redirectUri, done) {
  codes.findByCode(c, function(err, code) {
    debug('issueTokenFromCode: findByCode returned, code = ', code, ', err = ', err);
    if (err) { return done(err); }

    if (code.isRedeemed()) {
      return done(new TokenError('Code already redeemed',
                                 'invalid_request'));
    }
    if (code.isExpired()) {
      return done(new TokenError('Code expired', 'invalid_request'));
    }
    if (!code.matchesClientId(client.clientId)) {
      code.redeem(function(err, code) {
        if (err) { return done(err); }

        return done(new TokenError('Client ID does not match orignal request',
                                 'invalid_client'));
      });
    }
    if (!code.matchesRedirectUri(redirectUri)) {
      code.redeem(function(err, code) {
        if (err) { return done(err); }

        return done(new TokenError('Redirect URI does not match orignal ' +
                                   'request', 'invalid_request'));
      });
    }

    code.redeem(function(err, code) {
      if (err) { return done(err); }

      createToken(code.scope, code.user, code.clientId, function(err, token) {
        var extras = {
          'expires_in': token.expiresIn
        };

        if (code.scope.indexOf('openid') != -1) {
          extras['id_token'] = createIdToken(client.reqdomain, code.clientId, code.user,
            code.nonce);
        }

        done(null, token.token, extras);
      });
    });
  });
}

module.exports.issueToken = issueToken;
module.exports.issueCode = issueCode;
module.exports.issueTokenFromCode = issueTokenFromCode;
module.exports.issueIdToken = issueIdToken;
module.exports.createUserinfo = createUserinfo;
