'use strict';

const db = require('../db');
const debug = require('debug');
const trace = debug('arangodb#remoteResources:trace');
const aql = require('arangojs').aqlQuery;
const config = require('../config');

const remoteResources =
        db.collection(config.get('arangodb:collections:remoteResources:name'));

function getRemoteId(id, domain) {
    let ids = Array.isArray(id) ? id : [id];

    trace(`Looking up remote IDs for ${ids} at ${domain}`);
    return db.query(aql`
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
    `).call('all')
    .tap(rids => trace('Found:', rids));
}

function addRemoteId(rid, domain) {
    let rids = Array.isArray(rid) ? rid : [rid];

    trace('Adding remote IDs:', rids);
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
};
