'use strict';

const db = require('../db');
const debug = require('debug');
const info = debug('arangodb#resources:info');
const trace = debug('arangodb#resources:trace');
const _ = require('lodash');
var Promise = require('bluebird');
const aql = require('arangojs').aqlQuery;
const pointer = require('json-pointer');
const config = require('../config');
const util = require('../util');
const changes =
    db.collection(config.get('arangodb:collections:changes:name'));
const resources =
    db.collection(config.get('arangodb:collections:resources:name'));
const graphNodes =
    db.collection(config.get('arangodb:collections:graphNodes:name'));
const edges =
  db.collection(config.get('arangodb:collections:edges:name'));
const changeEdges =
    db.collection(config.get('arangodb:collections:changeEdges:name'));

const MAX_DEPTH = 100;

function getChanges(resourceId, changeRev) {
  return db.query(aql`
    FOR change in ${changes}
      FILTER change.resource_id == ${resourceId}
      RETURN CONCAT(change.number, '-', change.hash)
  `).call('all').then((result) => {
    if (!result) return
    return result
  })

}

function getChangesSinceRev(resourceId, rev) {
  let num = parseInt(rev.split('-')[0]);
  return db.query(aql`
    FOR change in ${changes}
      FILTER change.resource_id == ${resourceId}
      FILTER change.number > ${num}
      SORT change.number
      LET path = LAST(
        FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change ${changeEdges}
        RETURN p
      )
      RETURN path
  `).call('all').then((results) => {
    return Promise.map(results, (result) => {
      if (!result.vertices[0]) return
      let change = {
        body: result.vertices[0].body,
        type: result.vertices[result.vertices.length-1].type
      }
      let path = '';
      for (let i = 0; i < result.vertices.length-1; i++) {
        path += result.edges[i].path;
        pointer.set(change.body, path, result.vertices[i+1].body)
      }
      return change
    })
  })
}

// Produces a bare tree has a top level key at resourceId and traces down to the actual
// change that induced this rev update
// TODO: using .body allows the changes to be nested, but doesn't allow us to
// specify all of the other change details along the way down.
function getChange(resourceId, changeRev) {
  return db.query(aql`
    LET change = FIRST(
      FOR change in ${changes}
      FILTER change.resource_id == ${resourceId}
      FILTER change.number == ${+changeRev.split('-')[0]}
      RETURN change
    )
    LET path = LAST(
      FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change ${changeEdges}
      RETURN p
    )
    RETURN path
  
`).call('next').then((result) => {
    if (!result.vertices[0]) return
    let change = {
      body: result.vertices[0].body,
      type: result.vertices[result.vertices.length-1].type
    }
    let path = '';
    for (let i = 0; i < result.vertices.length-1; i++) {
      path += result.edges[i].path;
      pointer.set(change.body, path, result.vertices[i+1].body)
    }
    return change
  })
}

function getRootChange(resourceId, changeRev) {
  return db.query(aql`
    LET change = FIRST(
      FOR change in ${changes}
      FILTER change.resource_id == ${resourceId}
      FILTER change.number == ${+changeRev.split('-')[0]}
      RETURN change
    )
    LET path = LAST(
      FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND change ${changeEdges}
      RETURN v
    )
    RETURN path
  `).call('next')
}

function putChange({change, resId, rev, type, child, path, userId, authorizationId}) {
  let parts = rev.split('-');
  let number = +parts[0];
  let hash = parts.slice(1).join('-');
  // The FOR loop below is an if statement handling the case where no child
  // exists
  return db.query(aql`
    LET doc = FIRST(
      INSERT {
        body: ${change},
        type: ${type},
        resource_id: ${resId},
        hash: ${hash},
        number: ${number},
        authorization_id: ${authorizationId || null},
        user_id: ${userId || null}
      } IN ${changes}
      RETURN NEW
    )

    LET children = (
      FOR child IN ${child ? [child] : []}
        INSERT {
          _to: child,
          _from: doc._id,
          path: ${path || null}
        } in ${changeEdges}
    )
    RETURN doc._id
  `).tap((cursor) => {
  }).call('next');
}

module.exports = {
  getChangesSinceRev,
  getChange,
  getRootChange,
  getChanges,
  putChange,
};
