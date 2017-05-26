const config = require('../../config');
const db = require('arangojs')(config.get('arango:connectionString'));

db.useDatabase(config.get('arango:database'));

module.exports = {
    users: db.collection(config.get('arango:collections:users')),
  clients: db.collection(config.get('arango:collections:clients')),
   tokens: db.collection(config.get('arango:collections:tokens')),
    codes: db.collection(config.get('arango:collections:codes')),
};
