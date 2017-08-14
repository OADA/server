'use strict';

const config = require('../config');
const db = require('../db');
const aql = require('arangojs').aql;
const util = require('../util');

const users = require('./users.js');

const authorizations = db.collection(
    config.get('arangodb:collections:authorizations:name'));

function findByToken(token) {
  return db.query(aql`
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

      return users.findById(t.user._id)
        .then((user) => {
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
  return authorizations.save(token).then(() => findByToken(token.token));
}

module.exports = {
  findByToken,
  findByUser,
  save,
};
