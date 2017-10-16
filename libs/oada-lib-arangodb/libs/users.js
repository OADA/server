'use strict';

const debug = require('debug');
const info = debug('arangodb#resources:info');
const trace = debug('arangodb#resources:trace');
const uuid = require('uuid');
const config = require('../config');
const db = require('../db.js');
const aql = require('arangojs').aql;
const bcrypt = require('bcryptjs');
var Promise = require('bluebird');
const util = require('../util');
const users = db.collection(config.get('arangodb:collections:users:name'));

/*
  user {
    "_id": "users/123frank",
    "username": "frank",
    "password": "test",
    "name": "Farmer Frank",
    "family_name": "Frank",
    "given_name": "Farmer",
    "middle_name": "",
    "nickname": "Frankie",
    "email": "frank@openag.io"
    "oidc": {
      "sub": "02kfj023ifkldf", // subject, i.e. unique ID for this user
      "iss": "https://localhost", // issuer: the domain that gave out this ID
      "username": "bob", // can be used to pre-link this account to openidconnect identity
    }
  }
*/

function findById(id) {
  return users.document(id)
    .then(util.sanitizeResult)
    .catch({code: 404}, () => null);
}

function findByUsername(username) {
  return db.query(aql`
      FOR u IN ${users}
      FILTER u.username == ${username}
      RETURN u`
    )
    .call('next')
    .then((user) => {
      if (!user) {
        return null;
      }

      return util.sanitizeResult(user);
    });
}

function findByOIDCUsername(oidcusername) {
  return db.query(aql`
    FOR u IN ${users}
    FILTER u.oidc.username == ${username}
    RETURN u`
  )
  .call('next')
  .then((user) => {
    if (!user) {
      return null;
    }

    return util.sanitizeResult(user);
  });
}

// expects idtoken to be at least { sub: "fkj2o", iss: "https://localhost/example" }
function findByOIDCToken(idtoken) {
  return db.query(aql`
    FOR u IN ${users}
    FILTER u.oidc.sub == ${idtoken.sub}
    FILTER u.oidc.iss == ${idtoken.iss}
    RETURN u`
  )
  .call('next')
  .then((user) => {
    if (!user) {
      return null;
    }

    return util.sanitizeResult(user);
  });
}

function findByUsernamePassword(username, password) {
  return findByUsername(username)
    .then((user) => {
      if (!user) return null;
      return bcrypt.compare(password, user.password)
        .then((valid) => valid ? user : null);
    });
}

function create(u, returnNew = false) {
  let opts = {returnNew};
  return Promise.try(() => {
    info('create user was called');

    if (u.password) {
      u.password = hashPw(u.password);
    }

    // TODO: Good way to name bookmarks?
    //u.bookmarks = Object.assign({'_id': 'resources/' + uuid()}, u.bookmarks);

    return users.save(u, opts).then(r => r.new || r);
  });
}

function update(u) {
  return users.update(u._id, u);
}

function like(u) {
  return util.bluebirdCursor(users.byExample(u));
}

function hashPw(pw) {
  return bcrypt.hashSync(pw, config.get('arangodb:init:passwordSalt'));
}

module.exports = {
  findById,
  findByUsername,
  findByUsernamePassword,
  findByOIDCToken,
  findByOIDCUsername,
  create: create,
  update,
  like,
  hashPw: hashPw,
  // TODO: Better way to handler errors?
  // ErrorNum from: https://docs.arangodb.com/2.8/ErrorCodes/
  NotFoundError: {
    name: 'ArangoError',
    errorNum: 1202
  },
  UniqueConstraintError: {
    name: 'ArangoError',
    errorNum: 1210
  },
};
