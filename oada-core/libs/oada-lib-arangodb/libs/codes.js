'use strict'

const config = require('../config')
const db = require('../db')
const aql = require('arangojs').aql
const util = require('../util')
const debug = require('debug')('oada-lib-arangodb:codes')

const users = require('./users.js')

function findByCode (code) {
  return db
    .query(
      aql`
      FOR c IN ${db.collection(config.get('arangodb:collections:codes:name'))}
      FILTER c.code == ${code}
      RETURN c`
    )
    .call('next')
    .then(c => {
      if (!c) {
        return null
      }

      // removed this since we now have arango's _id === oada's _id
      //c._id = c._key;

      let userid = null
      if (c.user) userid = c.user._id
      return users.findById(userid).then(user => {
        c.user = user
        return util.sanitizeResult(c)
      })
    })
}

function save (code) {
  const q = aql`
    UPSERT { code: ${code.code} }
    INSERT ${code}
    UPDATE ${code}
    IN ${db.collection(config.get('arangodb:collections:codes:name'))}
  `
  return db.query(q).then(() => findByCode(code.code))
  /* This old method doesn't work because it only inserts:
  return db.collection(config.get('arangodb:collections:codes:name'))
    .save(code)
    .then(() => findByCode(code.code));
  */
}

module.exports = {
  findByCode,
  save
}
