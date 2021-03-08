'use strict';

const Bluebird = require('bluebird');

const config = require('../config');
const db = require('../db');
const { aql } = require('arangojs');
const util = require('../util');

function findById(id) {
  return db
    .query(
      aql`
      FOR c IN ${db.collection(config.get('arangodb:collections:clients:name'))}
      FILTER c.clientId == ${id}
      RETURN c`
    )
    .call('next')
    .then((client) => {
      if (!client) {
        return null;
      }

      return util.sanitizeResult(client);
    });
}

function save(client) {
  return db
    .collection(config.get('arangodb:collections:clients:name'))
    .save(client)
    .then(() => findById(client.clientId));
}

// Wrap with Bluebird to try to not break old code
module.exports = {
  findById: Bluebird.method(findById),
  save: Bluebird.method(save),
};
