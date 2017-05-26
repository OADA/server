'use strict';

module.exports = {
  arango: require('./db.js'),
  init: require('./init.js'),
  users: require('./libs/users.js'),
  resources: require('./libs/resources.js'),
  clients: require('./libs/clients.js'),
  codes: require('./libs/codes.js'),
  authorizations: require('./libs/authorizations.js')
}
