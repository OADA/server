'use strict';

const { aql } = require('arangojs');
const debug = require('debug');

const db = require('../db');
const config = require('../config');

const trace = debug('arangodb#remoteResources:trace');

const remoteResources = db.collection(
  config.get('arangodb:collections:remoteResources:name')
);

function getRemoteId(id, domain) {
  let ids = Array.isArray(id) ? id : [id];

  trace(`Looking up remote IDs for ${ids} at ${domain}`);
  return db
    .query(
      aql`
        FOR id IN ${ids}
            LET rid = FIRST(
                FOR rres IN ${remoteResources}
                    FILTER rres.resource_id == id
                    FILTER rres.domain == ${domain}
                    RETURN rres.remote_id
            )
            RETURN {
                rid: rid,
                id: id
            }
    `
    )
    .call('all')
    .tap((rids) => trace('Found: %O', rids));
}

function addRemoteId(rid, domain) {
  let rids = Array.isArray(rid) ? rid : [rid];

  trace('Adding remote IDs: %O', rids);
  return db.query(aql`
        FOR rid IN ${rids}
            INSERT {
                domain: ${domain},
                resource_id: rid.id,
                remote_id: rid.rid
            } INTO ${remoteResources}
    `);
}

module.exports = {
  getRemoteId,
  addRemoteId,
  // TODO: Better way to handler errors?
  // ErrorNum from: https://docs.arangodb.com/2.8/ErrorCodes/
  NotFoundError: {
    name: 'ArangoError',
    errorNum: 1202,
  },
  UniqueConstraintError: {
    name: 'ArangoError',
    errorNum: 1210,
  },
};
