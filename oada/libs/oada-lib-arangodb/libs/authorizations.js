'use strict';

const { aql } = require('arangojs');
const cloneDeep = require('clone-deep');
const debug = require('debug');
const Bluebird = require('bluebird');

const db = require('../db');
const util = require('../util');
const users = require('./users.js');
const config = require('../config');

const trace = debug('@oada/lib-arangodb#authorizations:trace');

const authorizations = db.collection(
  config.get('arangodb:collections:authorizations:name')
);

function findById(id) {
  return db
    .query(
      aql`
      FOR t IN ${authorizations}
        FILTER t._key == ${id}
        RETURN UNSET(t, '_key')`
    )
    .call('next');
}

function findByToken(token) {
  return db
    .query(
      aql`
      FOR t IN ${authorizations}
        FILTER t.token == ${token}
        RETURN t`
    )
    .call('next')
    .then((t) => {
      if (!t) {
        return null;
      }

      // no longer needed with new _id scheme
      //t._id = t._key;

      trace(
        'Found authorization by token (%s),' +
          ' filling out user from users collection by user._id',
        t
      );
      return users.findById(t.user._id).then((user) => {
        t.user = user;

        return util.sanitizeResult(t);
      });
    });
}

// TODO: Add index on user id
function findByUser(user) {
  let cur = db.query(aql`
    FOR t IN ${authorizations}
      FILTER t.user._id == ${user}
      FILTER t.revoked != true
      RETURN UNSET(t, '_key')
  `);

  return util.bluebirdCursor(cur);
}

function save(token) {
  const t = cloneDeep(token);
  if (t.user) t.user = { _id: t.user._id }; // make sure nothing but id is in user info
  // Have to get rid of illegal document handle _id
  if (t._id) {
    t._key = t._id.replace(/^authorizations\//, '');
    delete t._id;
  }
  trace('save: Replacing/Inserting token ', t);
  // overwrite will replace the given token if it already exists
  return authorizations
    .save(t, { overwrite: true })
    .then(() => findByToken(t.token));
}

function revoke(token) {
  return db.query(aql`
    UPDATE ${token} WITH { revoked: true } IN ${authorizations}
  `);
}

// Use with case: completely removes the authorization document from database:
function remove(a) {
  return authorizations.remove(a);
}

// Wrap with Bluebird to try to not break old code
module.exports = {
  findById: Bluebird.method(findById),
  findByToken: Bluebird.method(findByToken),
  findByUser: Bluebird.method(findByUser),
  save: Bluebird.method(save),
  revoke: Bluebird.method(revoke),
  remove: Bluebird.method(remove), // use with care!
};
