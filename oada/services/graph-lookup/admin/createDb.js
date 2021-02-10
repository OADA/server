'use strict';
let arangojs = require('arangojs');
let Database = arangojs.Database;
let aql = arangojs.aql;
let Promise = require('bluebird');
let debug = require('debug')('graph-lookup:admin:createDb');
let ADD_SAMPLE_DATA = process.env.ADD_SAMPLE_DATA;
let config = require('../config.js');
let serverAddr = config.get('arango:connectionString');
let dbname = 'graph-lookup-test';
let db = new Database(serverAddr);
db.useDatabase(dbname);
/*
  Creates Database.
  Can be required as module:
    - create() : Creates database
    - destory() : Destorys database


  Collections:
    - resources
    - graphNodes
    - edges

  Examples:
    graphNode {
      resourceId: <id of resource>
      isResource: true
    }

    resource {
      _id: <id of resource (me)>
      _rev:
      _meta: {
        _id: <id of meta resource (meta:<id of this resource>)>
        _rev:
      }
    }

    edge {
      _to: <id of graphNode B>
      _from: <id of graphNode A>
      name: <key name in resource for link>
    }
*/

let resources = db.collection('resources');
let graphNodes = db.collection('graphNodes');
let edges = db.edgeCollection('edges');

//Clear out any data that exists already.

var createDb = function createDB() {
  debug('Creating collections in database.');
  return Promise.all([resources.create(), graphNodes.create(), edges.create()]);
};

var destroyDb = function destroyDb() {
  return Promise.all([resources.drop(), graphNodes.drop(), edges.drop()]);
};

if (require.main === module) {
  debug('Creating collections in database.');
  return destroyDb()
    .catch(() => {})
    .then(() => {
      return createDb();
    });
}

module.exports = {
  create: createDb,
  destroy: destroyDb,
  collections: {
    resources: resources,
    graphNodes: graphNodes,
    edges: edges,
  },
};
