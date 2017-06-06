const config = require('../config');
const db = require('../db');
const aql = require('arangojs').aql;

const collection = db.collection(config.get('arangodb:collections:putBodies:name'));

function savePutBodyStr(bodystr) {
  // the _id comes back in the response to save
  return collection.save({ bodystr });
}

function getPutBodyStr(id) {
  return collection.document(id).then(result => result.bodystr);
}

function removePutBody(id) {
  return collection.remove(id);
}

module.exports = {
  savePutBodyStr,
  getPutBodyStr,
  removePutBody,
};
