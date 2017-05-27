'use strict';

const config = require('../config');
const db = require('../db');
const aql = require('arangojs').aql;

const users = require('./users.js');

function findByToken(token) {
  return db.query(aql`
      FOR t IN ${db.collection(config.get('arangodb:collections:authorizations:name'))}
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

          return t;
        });
    });
}

function save(token) {
  return db.collection(config.get('arangodb:collections:authorizations:name'))
    .save(token)
    .then(() => findByToken(token.token));
}

module.exports = {
  findByToken,
  save
};
