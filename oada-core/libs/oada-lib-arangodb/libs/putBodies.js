'use strict';

const config = require('../config');
const db = require('../db');

const collection =
    db.collection(config.get('arangodb:collections:putBodies:name'));

// Give string of JSON rather than object
function savePutBody(body) {
  // the _id comes back in the response to save
  return collection.save(`{"body":${body}}`);
}

function getPutBody(id) {
  return collection.document(id).get('body');
}

function removePutBody(id) {
  return collection.remove(id);
}

module.exports = {
  savePutBody,
  getPutBody,
  removePutBody,
};
