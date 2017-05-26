/* Copyright 2017 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 )* limitations under the License.
 */

'use strict';

const expect = require('chai').expect;
const Promise = require('bluebird');
const oadaLib = require('..');
const config = require('../config');

// TODO: Would be nice to just expose these examples on oadaLib itself --- feel
// like we will want them for all of the microservice tests
const exampleEdges = require('../libs/exampledocs/edges.js');
const exampleGraphNodes = require('../libs/exampledocs/graphNodes.js');

function lookupFromUrl(url) {
  return Promise.try(() => {
    let resource = db.collection('resources');
    let graphNodes = db.collection('graphNodes');
    let edges = db.collection('edges');
    let pieces = pointer.parse(url);
    pieces.splice(0, 1);
    let bindVars = {
      value0: pieces.length-1,
      value1: 'graphNodes/'+pieces[0],
    };
    let id = pieces.splice(0, 1);
  // Create a filter for each segment of the url
    const filters = pieces.map((urlPiece, i) => {
      let bindVarA = 'value' + (2+(i*2)).toString()
      let bindVarB = 'value' + (2+(i*2)+1).toString()
      bindVars[bindVarA] = i;
      bindVars[bindVarB] = urlPiece;
      return `FILTER p.edges[@${bindVarA}].name == @${bindVarB} || p.edges[@${bindVarA}].name == null`
    }).join(' ')
    let query = `FOR v, e, p IN 0..@value0
        OUTBOUND @value1
        edges
        ${filters}
        RETURN p`
    return db.query({query, bindVars})
      .then((cursor) => {
        let resource_id = '';
        let path_leftover = pointer.compile([id].concat(pieces));

        if (cursor._result.length < 1) {
          return {resource_id, path_leftover};
        }

        // Check for a traversal that did not finish (aka not found)
        if (cursor._result[cursor._result.length-1].vertices[0] === null) {
          return {resource_id, path_leftover};
        }

        let res =_.reduce(cursor._result, (result, value, key) => {
          if (result.vertices.length > value.vertices.length) return result
          return value
        })
        resource_id = res.vertices[res.vertices.length-1].resource_id;
        // If the desired url has more pieces than the longest path, the
        // path_leftover is the extra pieces
        if (res.vertices.length-1 < pieces.length) {
          let extras = pieces.length - (res.vertices.length-1)
          path_leftover = pointer.compile(pieces.slice(0-extras))
        } else {
          path_leftover = res.vertices[res.vertices.length-1].path || ''
        }

        return {resource_id, path_leftover}
      })
  })
}

function getResource(id, path) {
  // TODO: Escaping stuff?
  const parts = (path||'')
    .split('/')
    .filter(x => !!x);

  const bindVars = parts.reduce((b, part, i) => {
    b[`v${i}`] = part;
    return b;
  }, {});
  bindVars.id = id;

  const returnPath = parts.reduce((p, part, i) => p.concat(`[@v${i}]`), '');

  return db.query({
    query: `FOR r IN resources
        FILTER r._key == @id
        RETURN r${returnPath}`,
    bindVars
  })
  .catch({
      isArangoError: true,
      errorMessage: 'invalid traversal depth (while instantiating plan)'
    },
    () => null); // Treat non-existing path has not-found
}

function putResource(id, obj) {
    // Fix rev
    obj['_oada_rev'] = obj['_rev'];
    obj['_rev'] = undefined

    // TODO: Sanitize OADA keys?

    // TODO: Handling updating links
    obj['_key'] = id;
    return db.query(aql`
        UPSERT { '_key': ${id} }
        INSERT ${obj}
        UPDATE ${obj}
        IN resources
    `);
}

function upsertMeta(req) {
}

function upsertChanges(req) {
}

module.exports = {
  upsert,
  lookupFromUrl,
  getResource,
  putResource,
};
