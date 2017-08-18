'use strict';

module.exports = {
  arango: require('./db.js'),
  init: require('./init.js'),
  users: require('./libs/users.js'),
  resources: require('./libs/resources.js'),
  clients: require('./libs/clients.js'),
  codes: require('./libs/codes.js'),
  authorizations: require('./libs/authorizations.js'),
  putBodies: require('./libs/putBodies.js'),
  // call examples('resources') to get the list of example resources, etc.
  examples: collectionName => require('./libs/exampledocs/' + collectionName),
}
