'use strict'

const config = require('../config')
const db = require('../db')
const aql = require('arangojs').aql
const util = require('../util')
const debug = require('debug')
const trace = debug('oada-lib-arangodb#authorizations:trace')

const users = require('./users.js')

const authorizations = db.collection(
  config.get('arangodb:collections:authorizations:name')
)

function findById (id) {
  return db
    .query(
      aql`
      FOR t IN ${authorizations}
        FILTER t._key == ${id}
        RETURN UNSET(t, '_key')
    `
    )
    .call('next')
}

function findByToken (token) {
  return db
    .query(
      aql`
      FOR t IN ${authorizations}
      FILTER t.token == ${token}
      RETURN t`
    )
    .call('next')
    .then(t => {
      if (!t) {
        return null
      }

      // no longer needed with new _id scheme
      //t._id = t._key;

      trace(
        'Found authorization by token (' +
          t +
          '), filling out user from users collection by user._id'
      )
      return users.findById(t.user._id).then(user => {
        t.user = user

        return util.sanitizeResult(t)
      })
    })
}

// TODO: Add index on user id
function findByUser (user) {
  let cur = db.query(aql`
    FOR t IN ${authorizations}
      FILTER t.user._id == ${user}
      FILTER t.revoked != true
      RETURN UNSET(t, '_key')
  `)

  return util.bluebirdCursor(cur)
}

function save (token) {
  trace('save: Saving token ', token)
  return authorizations.save(token).then(() => findByToken(token.token))
}

function revoke (token) {
  return db.query(aql`
    UPDATE ${token} WITH { revoked: true } IN ${authorizations}
  `)
}

// Use with case: completely removes the authorization document from database:
function remove (a) {
  return authorizations.remove(a)
}

module.exports = {
  findById,
  findByToken,
  findByUser,
  save,
  revoke,
  remove // use with care!
}
