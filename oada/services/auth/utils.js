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

const crypto = require('crypto');

const { TokenError } = require('oauth2orize');
const jwt = require('jsonwebtoken');
const objectAssign = require('object-assign');
const debug = require('debug')('utils:trace');

const config = require('./config');
const tokens = require('./db/models/token');
const codes = require('./db/models/code');
const keys = require('./keys');

function makeHash(length) {
  return crypto
    .randomBytes(Math.ceil((length * 3) / 4))
    .toString('base64')
    .slice(0, length)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Iss is the domain of the issuer that is handing out the token
function createIdToken(iss, aud, user, nonce, userinfoScope) {
  userinfoScope = userinfoScope || [];

  const idToken = config.get('auth.idToken');
  debug(
    'createIdToken: creating token, kid = %s, keys.sign = %O',
    idToken.signKid,
    keys.sign
  );
  const options = {
    header: {
      kid: idToken.signKid,
    },
    algorithm: keys.sign[idToken.signKid].alg,
    expiresIn: idToken.expiresIn,
    audience: aud,
    subject: user.id,
    issuer: iss,
  };

  const payload = {
    iat: Date.now(),
  };

  if (nonce !== undefined) {
    payload.nonce = nonce;
  }

  const userinfo = createUserinfo(user, userinfoScope);

  if (userinfo) {
    objectAssign(payload, userinfo);
  }

  debug('createIdToken: signing payload of id token');
  const index = jwt.sign(payload, keys.sign[idToken.signKid].pem, options);
  debug('createIdToken: done signing payload of id token');

  return index;
}

function createToken(scope, user, clientId, done) {
  const token = config.get('auth.token');
  const tok = {
    token: makeHash(token.length),
    expiresIn: token.expiresIn,
    scope,
    user,
    clientId,
  };
  debug('createToken: about to save token %O', tok);
  tokens.save(tok, done);
}

function createUserinfo(user, scopes) {
  const userinfo = {};

  if (scopes.includes('profile')) {
    objectAssign(userinfo, {
      sub: user.id,
      name: user.name,
      family_name: user.family_name,
      given_name: user.given_name,
      middle_name: user.middle_name,
      nickname: user.nickname,
      preferred_username: user.username,
      profile: user.profile,
      picture: user.picture,
      website: user.website,
      gender: user.gender,
      birthdate: user.birthdate,
      zoneinfo: user.zoneinfo,
      locale: user.locale,
      updated_at: user.updated_at,
    });
  }

  if (scopes.includes('email')) {
    objectAssign(userinfo, {
      sub: user.id,
      email: user.email,
      email_verified: user.email_verified,
    });
  }

  if (scopes.includes('address')) {
    objectAssign(userinfo, {
      sub: user.id,
      address: user.address,
    });
  }

  if (scopes.includes('phone')) {
    objectAssign(userinfo, {
      sub: user.id,
      phone_number: user.phone_number,
      phone_number_verified: user.phone_number_verified,
    });
  }

  if (userinfo.sub === undefined) {
    return;
  }

  return userinfo;
}

function issueToken(client, user, ares, done) {
  createToken(ares.scope, user, client.clientId, (error, token) => {
    if (error) {
      return done(error);
    }

    done(null, token.token, { expires_in: token.expiresIn });
  });
}

function issueIdToken(client, user, ares, done) {
  const userinfoScope = ares.userinfo ? ares.scope : [];

  done(
    null,
    createIdToken(
      client.reqdomain,
      client.clientId,
      user,
      ares.nonce,
      userinfoScope
    )
  );
}

function issueCode(client, redirectUri, user, ares, done) {
  const code = config.get('auth.code');
  const c = {
    code: makeHash(code.length),
    expiresIn: code.expiresIn,
    scope: ares.scope,
    user,
    clientId: client.clientId,
    redirectUri,
  };

  if (ares.nonce) {
    c.nonce = ares.nonce;
  }

  debug('Saving new code: %s', c.code);
  codes.save(c, (error, code) => {
    if (error) {
      return done(error);
    }

    done(null, code.code);
  });
}

function issueTokenFromCode(client, c, redirectUri, done) {
  codes.findByCode(c, (error, code) => {
    debug(
      'issueTokenFromCode: findByCode returned, code = %O, err = %O',
      code,
      error
    );
    if (error) {
      return done(error);
    }

    if (code.isRedeemed()) {
      return done(new TokenError('Code already redeemed', 'invalid_request'));
    }

    if (code.isExpired()) {
      return done(new TokenError('Code expired', 'invalid_request'));
    }

    if (!code.matchesClientId(client.clientId)) {
      code.redeem((error) => {
        if (error) {
          return done(error);
        }

        return done(
          new TokenError(
            'Client ID does not match orignal request',
            'invalid_client'
          )
        );
      });
    }

    if (!code.matchesRedirectUri(redirectUri)) {
      code.redeem((error) => {
        if (error) {
          return done(error);
        }

        return done(
          new TokenError(
            'Redirect URI does not match orignal ' + 'request',
            'invalid_request'
          )
        );
      });
    }

    code.redeem((error, code) => {
      if (error) {
        return done(error);
      }

      createToken(code.scope, code.user, code.clientId, (_error, token) => {
        const extras = {
          expires_in: token.expiresIn,
        };

        if (code.scope.includes('openid')) {
          extras.id_token = createIdToken(
            client.reqdomain,
            code.clientId,
            code.user,
            code.nonce
          );
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
