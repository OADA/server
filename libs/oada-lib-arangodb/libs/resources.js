'use strict';
const db = require('../db');
const debug = require('debug');
const info = debug('info:arangodb#resources');
const trace = debug('trace:arangodb#resources');
const _ = require('lodash');
const Promise = require('bluebird');
const uuidV4 = require('uuid/v4');
const moment = require('moment');
const aql = require('arangojs').aqlQuery;
const md5 = require('md5');
const pointer = require('json-pointer')
const config = require('../config')
const util = require('../util');
config.set('isTest', true)
const resName = config.get('arangodb:collections:resources:name')
const gnName = config.get('arangodb:collections:graphNodes:name')
const eName = config.get('arangodb:collections:edges:name')

//----------------------------------------
// - Create a resource with a given id and content.
// - This will also create a meta resource.
// - This will also update the graph to point to from
//   the resource to the meta resource.
// req should look like:
// {
//   body: {                        // body is REQUIRED
//     _id: 'resources/kjf20i3kfl3f2j',
//     _type: 'application/vnd.oada.bookmarks.1+json',
//   },
//   revPrefix: 154,                 // revPrefix is REQUIRED: it's the integer part on the front of the _rev.  Use the offset from Kafka partition.
//   userid: "users/kjf02ij3fkls",  // user is REQUIRED
//   authorizationid: 'authorizations/kdf02ijklsjfo23ik32k", // authorizationid is OPTIONAL if not created from an API request
// }
function upsert(req) {
  /*
  const c; // resources collection
  const rescol; // collection name, shorter than config.get('arangodb:collections:resources')
  const graphcol;
  const meta; // id of meta if we're making one
  const exists = false;
  const hasmeta = false;
  return Promise.try(() => {
    opts = opts || {};
    req = _.cloneDeep(req);

    rescol = config.get('arangodb:collections:resources');
    graphcol = config.get('arangodb:collections:graphNodes');

    if (!req.body) {
      info('req._body required but not given');
      throw new Error({ code: 'MISSING_BODY' });
    }

    // If they gave an _id, move it to _key for arango
    if (req.body._id) {
      req.body._key = req.body._id;
      delete req.body._id;
    }
    // Can't create a resource without specifying the _key for arango
    if (!req.body._key) {
      info('req.body._id (oada _id) or req.body._key required, but neither was given.');
      throw new Error({ code: 'MISSING_ID'});
    }
    if (!req.body._type) {
      info('req.body._type required, but not given.');
      throw new Error({ code: 'MISSING_TYPE'});
    }
    if (!req.user || !req.user._id) {
      info('req.user and req.user._id required, but not given');
      throw new Error({ code: 'MISSING_USER'});
    }
    if (!req.revPrefix) {
      info('req.revPrefix is required, but not given');
      throw new Error({ code: 'MISSING_REVPREFIX'});
    }
    // This library sets up meta and rev, so get rid of any from outside:
    if (req.body._meta) delete r.body._meta;
    if (req.body._rev) delete r.body._rev;


    //--------------------------------------------------------------------------------------
    // 1: Decide new rev
    const rev = req.revPrefix+'-'+md5(req);

    // 2: Check database to see if this change is to a meta resource or an actual resource
    return db.query(aql`FOR r IN ${colname} FILTER r._key == ${req.body._key} RETURN { _key: r._key, _meta: r._meta }`)
    .then(res => { exists = !!res._key; hasmeta = !!res._meta; })

  }).then(() => {
    //--------------------------------------------------------------------------------------
    // 3: Upsert request to _changes
    const node = graphcol+'/'+req.body._key;
    if (hasmeta) { // db object is a meta object, so 1-hop in the graph
      return db.query(aql`
        FOR v,e IN 1..1
          OUTBOUND ${node}
          edges FILTER e.name == '_changes' AND p.edges[1] == null
          UPDATE


    } else { // db object is a resource, so 2-hops in the graph
    return db.query(aql`
      FOR v,e,p IN 1..2
        OUTBOUND ${node}
        edges FILTER p.edges[0].name == '_meta' AND p.edges[1].name == '_changes'
              FILTER p.edges[0].name == '_changes' AND p.edges[1] == null


    }

    const startnode = graphcol+'/'+req.body._key;
    // If changing meta doc, post req

    //--------------------------------------------------------------------------------------
    // 1. Need to decide if it already exists or if we need to make it because if it is new,
    //    we have to create it's meta document, etc.

  }).then(res => {
    exists = !!res._key;
    hasmeta = !!res._meta;
    // If it doesn't exist we're creating a new one:
    if (!exists) {
      // If making a resource, make its meta document first:
      if (!req.isMeta) {
        const meta = {
          _key: uuidV4().replace('-',''), // I don't like the dashes
          _type: req.body._type,
          _owner: req.user._id,
          _client: (req.client ? req.client : null),
          _stats: {
            createdBy: { _id: req.user._id },
            created: moment().unix(),
            modifiedBy: { _id: req.user._id },
            modified: moment().unix(),
          }
        };
        return create({
          body: meta,
          user: req.user,
          client: req.client,
          isMeta: true,
        });
      }
    }
    //------------------------------------
    // 1. If regular resource, create meta document
    if (!req.isMeta) { // false or undefined
    }
  // Now meta exists, create actual resource
  }).then(() => {
  });
  */
}

function lookupFromUrl(url) {
  return Promise.try(() => {
    let resource = db.collection(resName);
    let graphNodes = db.collection(gnName);
    let edges = db.collection(eName);
    let pieces = pointer.parse(url);
    var startNode = 'graphNodes/' + pieces[0] + ':' + pieces[1]; // resources/123 => graphNodes/resources:123
    let bindVars = {
      value0: pieces.length-2, // need to not count first two entries since they are in startNode
      value1: startNode,
    }
    let id = pieces.splice(0, 2);
  // Create a filter for each segment of the url
    const filters = pieces.map((urlPiece, i) => {
      let bindVarA = 'value' + (2+(i*2)).toString();
      let bindVarB = 'value' + (2+(i*2)+1).toString();
      bindVars[bindVarA] = i;
      bindVars[bindVarB] = urlPiece;
      return `FILTER p.edges[@${bindVarA}].name == @${bindVarB} || p.edges[@${bindVarA}].name == null`
    }).join(' ')
    let query = `FOR v, e, p IN 0..@value0
        OUTBOUND @value1
        edges
        ${filters}
        RETURN p`
    trace('lookupFromUrl('+url+'): running query: ', query, ', bindVars = ', bindVars);
    return db.query({query, bindVars})
      .then((cursor) => {
        trace('lookupFromUrl('+url+'): query result = ', JSON.stringify(cursor._result,false,'  '));
        let resource_id = '';
        let path_leftover = pointer.compile(id.concat(pieces));

        if (cursor._result.length < 1) {
          trace('lookupFromUrl('+url+'): cursor._result.length < 1');
          return {resource_id, path_leftover};
        }

        // Check for a traversal that did not finish (aka not found)
        if (cursor._result[cursor._result.length-1].vertices[0] === null) {
          trace('lookupFromUrl('+url+'): cursor._result[end].vertices[0] === null');
          return {resource_id, path_leftover};
        }

        // find the longest path:
        let res = _.reduce(cursor._result, (result, value, key) => {
          if (result.vertices.length > value.vertices.length) return result
          return value
        },{vertices: -1});
        trace('lookupFromUrl('+url+'): longest path has '+res.vertices.length+' vertices');
        resource_id = res.vertices[res.vertices.length-1].resource_id;
        // If the desired url has more pieces than the longest path, the
        // path_leftover is the extra pieces
        if (res.vertices.length-1 < pieces.length) {
          trace('lookupFromUrl('+url+'): more URL pieces than vertices, computing path');
          let extras = pieces.length - (res.vertices.length-1)
          path_leftover = pointer.compile(pieces.slice(0-extras))
        } else {
          trace('lookupFromUrl('+url+'): same number URL pieces as vertices, path is whatever is on graphNode');
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
        FILTER r._id == @id
        RETURN r${returnPath}`,
    bindVars
  }).then(result => result.next())
  .then(util.sanitizeResult)
  .catch({
      isArangoError: true,
      errorMessage: 'invalid traversal depth (while instantiating plan)'
    },
    () => null); // Treat non-existing path has not-found
}

function getParents(to_resource_id) {
  let edges = db.collection('edges');
	let resources = db.collection('resources');

	let bindVars = {
		to_resource_id: 'graphNodes' + to_resource_id 
	};

	let parents = [];
	let parent = {
		resource_id: null,
		path: null,
		contentType: null
	};

	let parent_query = `FOR v, e IN 0..1
			INBOUND @to_resource_id
			edges
			FILTER e.versioned == true
			RETURN {v:v, e:e}`

  return db.query({
    query: parent_query,
    bindVars
  })
	.then((cursor) => {
		let i = 0;

		// console.log(cursor._result);
		let length = cursor._result.length;
		trace('getParents'+'('+to_resource_id+')'+' parents length is '+length);

		for (i = 0; i < length; i++) {
			parent.resource_id = cursor._result[i].v.resource_id;
			parent.path = cursor._result[i].v.path + '/' + cursor._result[i].e.name;
			parents.splice(i, 0, parent);
		}

		return Promise.map(parents, parent => {
			return db.query(aql`
				FOR r in resources
				FILTER r._id == ${parent.resource_id}
				RETURN r._type`)
				.then(cursor => cursor.next())
				.then(result => {
					// console.log(parent);
					parent.contentType = result;
				})
		})
		.then(() => {
			// all done
			return parents;
		});
	})
  .catch({
      isArangoError: true,
      errorMessage: 'invalid traversal depth (while instantiating plan)'
    },
    () => null); // Treat non-existing path has not-found
}

function insertResource(id, obj) {
  // Fix rev
  obj['_oada_rev'] = obj['_rev'];
  obj['_rev'] = undefined;

  // TODO: Sanitize OADA keys?

  obj['_key'] = id.replace(/^resources\//, '');

  var doc = addLinks(obj).then(obj => db.query(aql`
    INSERT ${obj}
    IN resources
  `));
  var node = db.query(aql`
    INSERT {
      '_key': ${'resources:' + obj['_key']},
      'is_resource': true,
      'resource_id': ${id}
    }
    IN graphNodes
  `);

  return Promise.join(doc, node, links);
}

// TODO: Remove links as well
function addLinks(res) {
  function forLinks(res, cb, path) {
    path = path || [];


    return Promise.map(Object.keys(res), key => {
      // Just ignore _meta for now TODO: Allow links in _meta?
      if (key === '_meta') {
          return;
      }

      if (res[key] && res[key].hasOwnProperty('_id')) {
        return cb(res[key], path.concat(key));
      } else if (typeof res[key] === 'object' && res[key] !== null) {
        return forLinks(res[key], cb, path.concat(key));
      }
    });
  }

  // TODO: Use fewer queries or something?
  return forLinks(res, function(link, path) {
    var id = link['_id'].replace(/^resources\//, '');
    var nodeIds = [res['_key']]
        .concat(path.slice(0, -1))
        .map(function(p, i, a) {
          return ['graphNodes/resources'].concat(a.slice(0, i+1)).join(':');
        })
        .concat('graphNodes/resources:' + id);

    var fakeLinks = Promise.map(path.slice(0, -1), function(p, i) {
      trace(`Adding edge ${p} from ${nodeIds[i]} to ${nodeIds[i+1]}`);
      var ppath = path.slice(0, i+1);

      return db.query(aql`
        INSERT {
          '_key': ${['resources'].concat(res['_key']).concat(ppath).join(':')},
          'is_resource': false,
          'path': ${pointer.compile(ppath)},
          'resource_id': ${'resources/' + res['_key']}
        }
        IN graphNodes
      `).then(function fakeEdge() {
        return db.query(aql`
          INSERT {
            '_from': ${nodeIds[i]},
            '_to': ${nodeIds[i+1]},
            'name': ${p},
            'versioned': false
          }
          IN edges
        `);
      }).catch({
          isArangoError: true,
          errorNum: 1210 // ERROR_ARANGO_UNIQUE_CONSTRAINT_VIOLATED
      }, () => {}); // Node was already there, so ignore the error
    });

    // TODO: Check if edges already exist
    trace(`Adding edge ${path.slice(-1)[0]}`
        + ` from ${nodeIds.slice(-2, -1)[0]} to ${nodeIds.slice(-1)[0]}`);
    var edge = db.query(aql`
      INSERT {
        '_from': ${nodeIds.slice(-2, -1)[0]},
        '_to': ${nodeIds.slice(-1)[0]},
        'name': ${path.slice(-1)[0]},
        'versioned': ${link.hasOwnProperty('_rev')}
      }
      IN edges
    `);

    var rev;
    if (link.hasOwnProperty('_rev')) {
      rev = getResource(link['_id'], '_oada_rev')
        .then(function updateRev(rev) {
          link['_rev'] = rev;
        });
    }

    return Promise.join(edge, fakeLinks, rev);
  }).then(() => res);
}

function updateResource(id, obj) {
  // Fix rev
  obj['_oada_rev'] = obj['_rev'];
  obj['_rev'] = undefined;

  // TODO: Sanitize OADA keys?

  obj['_key'] = id.replace(/^resources\//, '');

  return addLinks(obj).then(obj => db.query(aql`
    UPDATE ${obj}
    IN resources
  `));
}

function upsertMeta(req) {
}

function upsertChanges(req) {
}

module.exports = {
  upsert,
  lookupFromUrl,
  getResource,
  insertResource,
  updateResource,
  getParents
};
