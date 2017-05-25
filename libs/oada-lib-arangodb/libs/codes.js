'use strict';

const config = require('../config');
const db = require('../db');
const aql = require('arangojs').aql;

const users = require('./users.js');

function findByCode(code) {
  return db.query(aql`
      FOR c IN ${db.collection(config.get('arangodb:collections:codes:name'))}
      FILTER c.code == ${code}
      RETURN c`
    )
    .call('next')
    .then((c) => {
      if (!c) {
        return null;
      }

      c._id = c._key;

      return users.findById(c.code)
        .then((user) => {
          c.user = user;
          return c;
        });
    });
}

function save(code) {
  return db.collection(config.get('arangodb:collections:codes:name'))
    .save(code)
    .then(() => findByCode(code.code));
}

module.exports = {
  findByCode,
  save
};
