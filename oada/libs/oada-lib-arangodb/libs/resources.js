'use strict';

const db = require('../db');
const debug = require('debug');
const info = debug('arangodb#resources:info');
const trace = debug('arangodb#resources:trace');
const cloneDeep = require('clone-deep');
const Bluebird = require('bluebird');
const { aql } = require('arangojs');
const pointer = require('json-pointer');
const config = require('../config');
const util = require('../util');
const users = require('./users');
const resources = db.collection(
  config.get('arangodb:collections:resources:name')
);
const graphNodes = db.collection(
  config.get('arangodb:collections:graphNodes:name')
);
const edges = db.collection(config.get('arangodb:collections:edges:name'));

const MAX_DEPTH = 100; // TODO: Is this good?

async function lookupFromUrl(url, userId) {
  const user = await users.findById(userId);
  if (!user) throw 'No User Found for given userId';
  if (/^\/bookmarks/.test(url)) {
    url = url.replace(/^\/bookmarks/, '/' + user.bookmarks._id);
  }
  if (/^\/shares/.test(url)) {
    url = url.replace(/^\/shares/, '/' + user.shares._id);
  }
  //    trace(userId);
  const pieces = pointer.parse(url);
  // resources/123 => graphNodes/resources:123
  const startNode = graphNodes.name + '/' + pieces[0] + ':' + pieces[1];
  const id = pieces.splice(0, 2);
  // Create a filter for each segment of the url
  const filters = pieces
    .map((urlPiece, i) => {
      return `FILTER p.edges[${i}].name == '${urlPiece}' || p.edges[${i}].name == null`;
    })
    .join(' ');
  const query = `
      WITH ${edges.name}, ${graphNodes.name}
      LET path = LAST(
        FOR v, e, p IN 0..${pieces.length}
          OUTBOUND '${startNode}'
          ${edges.name}
          ${filters}
          RETURN p
      )
      LET resources = DOCUMENT(path.vertices[*].resource_id)
      LET type = null
      LET permissions = (
        FOR r IN resources
        RETURN {
          type: r._type || type,
          owner: r._meta._owner == '${userId}' || r._meta._permissions['${userId}'].owner,
          read: r._meta._owner == '${userId}' || r._meta._permissions['${userId}'].read,
          write: r._meta._owner == '${userId}' || r._meta._permissions['${userId}'].write
        }
      )
      LET rev = DOCUMENT(LAST(path.vertices).resource_id)._oada_rev
      RETURN MERGE(path, {permissions, rev, type})
    `;
  trace('Query: %s', query);
  return db
    .query({ query, bindVars: {} })
    .call('next')
    .then((result) => {
      let resource_id = pointer.compile(id.concat(pieces)).replace(/^\//, ''); // Get rid of leading slash from json pointer

      let rev = result.rev;
      let type = result.type;
      let resourceExists = true;

      let path_leftover = '';
      let from = { resource_id: '', path_leftover: '' };

      if (!result) {
        trace('1 return resource id', resource_id);
        return {
          resource_id,
          path_leftover,
          from,
          permissions: {},
          rev,
          type,
        };
      }

      // Walk up and find the graph and return furthest known permissions (and
      // type)
      let permissions = { owner: null, read: null, write: null, type: null };
      result.permissions.reverse().some((p) => {
        if (p) {
          if (permissions.read === null) {
            permissions.read = p.read;
          }
          if (permissions.write === null) {
            permissions.write = p.write;
          }
          if (permissions.owner === null) {
            permissions.owner = p.owner;
          }
          if (permissions.type === null) {
            permissions.type = p.type;
          }
          if (
            permissions.read !== null &&
            permissions.write !== null &&
            permissions.owner !== null &&
            permissions.type !== null
          ) {
            return true;
          }
        }
      });
      type = permissions.type;

      // Check for a traversal that did not finish (aka not found)
      if (result.vertices[0] === null) {
        trace('graph-lookup traversal did not finish');
        trace('2 return resource id', resource_id);

        return {
          resource_id,
          path_leftover,
          from,
          permissions,
          rev,
          type,
          resourceExists: false,
        };
        // A dangling edge indicates uncreated resource; return graph lookup
        // starting at this uncreated resource
      } else if (!result.vertices[result.vertices.length - 1]) {
        let lastEdge = result.edges[result.edges.length - 1]._to;
        path_leftover = '';
        resource_id = 'resources/' + lastEdge.split('graphNodes/resources:')[1];
        trace('graph-lookup traversal uncreated resource', resource_id);
        rev = 0;
        from = result.vertices[result.vertices.length - 2];
        let edge = result.edges[result.edges.length - 1];
        from = {
          resource_id: from ? from['resource_id'] : '',
          path_leftover:
            ((from && from['path']) || '') + (edge ? '/' + edge.name : ''),
        };
        resourceExists = false;
      } else {
        resource_id =
          result.vertices[result.vertices.length - 1]['resource_id'];
        trace('graph-lookup traversal found resource', resource_id);
        from = result.vertices[result.vertices.length - 2];
        let edge = result.edges[result.edges.length - 1];
        // If the desired url has more pieces than the longest path, the
        // pathLeftover is the extra pieces
        if (result.vertices.length - 1 < pieces.length) {
          let revVertices = cloneDeep(result.vertices).reverse();
          let lastResource =
            result.vertices.length -
            1 -
            revVertices.findIndex((v) => v === 'is_resource');
          // Slice a negative value to take the last n pieces of the array
          path_leftover = pointer.compile(
            pieces.slice(lastResource - pieces.length)
          );
        } else {
          path_leftover =
            result.vertices[result.vertices.length - 1].path || '';
        }
        from = {
          resource_id: from ? from['resource_id'] : '',
          path_leftover:
            ((from && from['path']) || '') + (edge ? '/' + edge.name : ''),
        };
      }

      return {
        type,
        rev,
        resource_id,
        path_leftover,
        permissions,
        from,
        resourceExists,
      };
    });
}

function getResource(id, path) {
  // TODO: Escaping stuff?
  const parts = (path || '').split('/').filter((x) => !!x);

  if (parts[0] === '_rev') {
    // Get OADA rev, not arango one
    parts[0] = '_oada_rev';
  }

  let bindVars = parts.reduce((b, part, i) => {
    b[`v${i}`] = part;
    return b;
  }, {});
  bindVars.id = id;
  bindVars['@collection'] = resources.name;

  const returnPath = parts.reduce((p, _, i) => p.concat(`[@v${i}]`), '');

  return Bluebird.resolve(
    db.query({
      query: `
      WITH ${resources.name}
      FOR r IN @@collection
        FILTER r._id == @id
        RETURN r${returnPath}`,
      bindVars,
    })
  )
    .then((result) => result.next())
    .then(util.sanitizeResult)
    .catch(
      {
        isArangoError: true,
        errorMessage: 'invalid traversal depth (while instantiating plan)',
      },
      () => null
    ); // Treat non-existing path has not-found
}

function getResourceOwnerIdRev(id) {
  return Bluebird.resolve(
    db.query({
      query: `
      WITH ${resources.name}
      FOR r IN @@collection
        FILTER r._id == @id
        RETURN {
          _rev: r._oada_rev,
          _id: r._id,
          _meta: { _owner: r._meta._owner }
        }
    `,
      bindVars: {
        id,
        '@collection': resources.name,
      }, // bind id to @id
    })
  )
    .then((result) => result.next())
    .then((obj) => {
      trace('getResourceOwnerIdRev(' + id + '): result = ', obj);
      return obj;
    })
    .catch(
      {
        isArangoError: true,
        errorMessage: 'invalid traversal depth (while instantiating plan)',
      },
      () => null
    ); // Treat non-existing path has not-found
}

function getParents(id) {
  return Bluebird.resolve(
    db.query(
      aql`
    WITH ${edges}, ${graphNodes}, ${resources}
    FOR v, e IN 0..1
      INBOUND ${'graphNodes/' + id.replace(/\//, ':')}
      ${edges}
      FILTER e.versioned == true
      LET res = DOCUMENT(v.resource_id)
      RETURN {
        resource_id: v.resource_id,
        path: CONCAT(v.path || '', '/', e.name),
        contentType: res._type
      }`
    )
  )
    .call('all')
    .catch(
      {
        isArangoError: true,
        errorMessage: 'invalid traversal depth (while instantiating plan)',
      },
      () => null
    ); // Treat non-existing path has not-found
}

function getNewDescendants(id, rev) {
  // TODO: Better way to compare the revs?
  return db
    .query(
      aql`
    WITH ${graphNodes}, ${edges}, ${resources}
    LET node = FIRST(
      FOR node in ${graphNodes}
        FILTER node.resource_id == ${id}
        RETURN node
    )

    FOR v, e, p IN 0..${MAX_DEPTH} OUTBOUND node ${edges}
      FILTER p.edges[*].versioned ALL == true
      FILTER v.is_resource
      LET ver = SPLIT(DOCUMENT(LAST(p.vertices).resource_id)._oada_rev, '-', 1)
      // FILTER TO_NUMBER(ver) >= ${parseInt(rev, 10)}
      RETURN DISTINCT {
        id: v.resource_id,
        changed: TO_NUMBER(ver) >= ${parseInt(rev, 10)}
      }
  `
    )
    .call('all');
}

function getChanges(id, rev) {
  // Currently utilizes fixed depth search "7..7" to get data points down
  return db
    .query(
      aql`
    WITH ${graphNodes}, ${edges}, ${resources}
    LET node = FIRST(
      FOR node in ${graphNodes}
        FILTER node.resource_id == ${id}
        RETURN node
    )

    LET objs = (FOR v, e, p IN 7..7 OUTBOUND node ${edges}
      FILTER v.is_resource
      LET ver = SPLIT(DOCUMENT(v.resource_id)._oada_rev, '-', 1)
      FILTER TO_NUMBER(ver) >= ${parseInt(rev, 10)}
      RETURN DISTINCT {
        id: v.resource_id,
        rev: DOCUMENT(v.resource_id)._oada_rev
      }
    )
    FOR obj in objs
      LET doc = DOCUMENT(obj.id)
      RETURN {id: obj.id, changes: doc._meta._changes[obj.rev]}
  `
    )
    .call('all');
}

function putResource(id, obj, checkLinks = true) {
  // Fix rev
  obj['_oada_rev'] = obj['_rev'];
  obj['_rev'] = undefined;

  // TODO: Sanitize OADA keys?
  // _key is now an illegal document key
  obj['_key'] = id.replace(/^\/?resources\//, '');
  trace(`Adding links for resource ${id}...`);

  return (checkLinks ? addLinks(obj) : Promise.resolve([])).then(
    function docUpsert(links) {
      info(`Upserting resource ${obj._key}`);
      trace(`Upserting links: ${JSON.stringify(links, null, 2)}`);

      // TODO: Should it check that graphNodes exist but are wrong?
      var q;
      if (links.length > 0) {
        let thingy = aql`
        LET reskey = ${obj['_key']}
        LET resup = FIRST(
          LET res = ${obj}
          UPSERT { '_key': reskey }
          INSERT res
          UPDATE res
          IN ${resources}
          RETURN { res: NEW, orev: OLD._oada_rev }
        )
        LET res = resup.res
        FOR l IN ${links}
          LET lkey = SUBSTRING(l._id, LENGTH('resources/'))
          LET nodeids = FIRST(
            LET nodeids = (
              LET nodeids = APPEND([reskey], SLICE(l.path, 0, -1))
              FOR i IN 1..LENGTH(nodeids)
                LET path = CONCAT_SEPARATOR(':', SLICE(nodeids, 0, i))
                RETURN CONCAT('resources:', path)
            )
            LET end = CONCAT('resources:', lkey)
            RETURN APPEND(nodeids, [end])
          )
          LET nodes = APPEND((
            FOR i IN 0..(LENGTH(l.path)-1)
              LET isresource = i IN [0, LENGTH(l.path)]
              LET ppath = SLICE(l.path, 0, i)
              LET resid = i == LENGTH(l.path) ? lkey : reskey
              LET path = isresource ? null
                  : CONCAT_SEPARATOR('/', APPEND([''], ppath))
              UPSERT { '_key': nodeids[i] }
              INSERT {
                '_key': nodeids[i],
                'is_resource': isresource,
                'path': path,
                'resource_id': res._id
              }
              UPDATE {}
              IN ${graphNodes}
              OPTIONS { ignoreErrors: true }
              RETURN NEW
          ), { _id: CONCAT('graphNodes/', LAST(nodeids)), is_resource: true })
          LET edges = (
            FOR i IN 0..(LENGTH(l.path)-1)
              UPSERT {
                '_from': nodes[i]._id,
                'name': l.path[i]
              }
              INSERT {
                '_from': nodes[i]._id,
                '_to': nodes[i+1]._id,
                'name': l.path[i],
                'versioned': nodes[i+1].is_resource && HAS(l, '_rev')
              }
              UPDATE {
                '_to': nodes[i+1]._id,
                'versioned': nodes[i+1].is_resource && HAS(l, '_rev')
              }
              IN ${edges}
              RETURN NEW
          )
          RETURN resup.orev
      `;

        q = db.query(thingy);
      } else {
        q = db.query(aql`
        LET resup = FIRST(
          LET res = ${obj}
          UPSERT { '_key': res._key }
          INSERT res
          UPDATE res
          IN ${resources}
          return { res: NEW, orev: OLD._oada_rev }
        )
        LET res = resup.res
        LET nodekey = CONCAT('resources:', res._key)
        UPSERT { '_key': nodekey }
        INSERT {
          '_key': nodekey,
          'is_resource': true,
          'resource_id': res._id
        }
        UPDATE {}
        IN ${graphNodes}
        OPTIONS {exclusive: true, ignoreErrors: true }
        RETURN resup.orev
      `);
      }

      return q.call('next');
    }
  );
}

function forLinks(res, cb, path) {
  path = path || [];

  return Bluebird.map(Object.keys(res), (key) => {
    if (res[key] && res[key].hasOwnProperty('_id') && key !== '_meta') {
      // If it has _id and is not _meta, treat as a link
      return cb(res[key], path.concat(key));
    } else if (typeof res[key] === 'object' && res[key] !== null) {
      return forLinks(res[key], cb, path.concat(key));
    }
  });
}

// TODO: Remove links as well
async function addLinks(res) {
  // TODO: Use fewer queries or something?
  const links = [];

  await forLinks(res, async function processLinks(link, path) {
    // Ignore _changes "link"?
    if (path[0] === '_meta' && path[1] === '_changes') {
      return;
    }

    if (link.hasOwnProperty('_rev')) {
      const rev = await getResource(link['_id'], '_oada_rev');
      link['_rev'] = typeof rev === 'number' ? rev : 0;
    }

    links.push(Object.assign({ path }, link));
  });

  return links;
}

function makeRemote(res, domain) {
  return forLinks(res, (link) => {
    // Change all links to remote links
    link['_rid'] = link['_id'];
    link['_rrev'] = link['_rev'];
    delete link['_id'];
    delete link['_rev'];
    link['_rdomain'] = domain;
  }).then(() => res);
}

function deleteResource(id) {
  //TODO: fix this: for some reason, the id that came in started with
  ///resources, unlike everywhere else in this file
  let key = id.replace(/^\/?resources\//, '');

  // Query deletes resouce, its nodes, and outgoing edges (but not incoming)
  return db
    .query(
      aql`
    LET res = FIRST(
      REMOVE { '_key': ${key} } IN ${resources}
      RETURN OLD
    )
    LET nodes = (
      FOR node in ${graphNodes}
        FILTER node['resource_id'] == res._id
        REMOVE node IN ${graphNodes}
        RETURN OLD
    )
    LET edges = (
      FOR node IN nodes
        FOR edge IN ${edges}
          FILTER edge['_from'] == node._id
          REMOVE edge IN ${edges}
    )
    RETURN res._oada_rev
  `
    )
    .call('next');
}

// "Delete" a part of a resource
async function deletePartialResource(id, path, doc = {}) {
  const key = id.replace(/^resources\//, '');
  path = Array.isArray(path) ? path : pointer.parse(path);

  // TODO: Less gross way to check existence of JSON pointer in AQL??
  let pathA = path.slice(0, path.length - 1).join("']['");
  pathA = pathA ? "['" + pathA + "']" : pathA;
  const pathB = path[path.length - 1];
  const stringA = `(res${pathA}, '${pathB}')`;
  const hasStr = `HAS${stringA}`;

  const rev = doc['_rev'];
  pointer.set(doc, path, null);

  const name = path.pop();
  path = pointer.compile(path) || null;
  const hasObj = await db
    .query({
      query: `
        LET res = DOCUMENT(${resources.name}, '${key}')
        LET has = ${hasStr}

        RETURN {has, rev: res._oada_rev}
      `,
      bindVars: {},
    })
    .call('next');
  if (hasObj.has) {
    // TODO: Why the heck does arango error if I update resource before graph?
    return db
      .query(
        aql`
          LET start = FIRST(
            FOR node IN ${graphNodes}
              LET path = node.path || null
              FILTER node['resource_id'] == ${id} AND path == ${path || null}
              RETURN node
          )

          LET v = (
            FOR v, e, p IN 1..${MAX_DEPTH} OUTBOUND start ${edges}
              OPTIONS { bfs: true, uniqueVertices: 'global' }
              FILTER p.edges[0].name == ${name}
              FILTER p.vertices[*].resource_id ALL == ${id}
              REMOVE v IN ${graphNodes}
              RETURN OLD
          )

          LET e = (
            FOR edge IN ${edges}
              FILTER (v[*]._id ANY == edge._to) || (v[*]._id ANY == edge._from) || (edge._from == start._id && edge.name == ${name})
              REMOVE edge IN ${edges}
              RETURN OLD
          )

          LET newres = MERGE_RECURSIVE(
            ${doc},
            {
              _oada_rev: ${rev},
              _meta: {_rev: ${rev}}
            }
          )

          UPDATE ${key} WITH newres IN ${resources} OPTIONS {keepNull: false}
          RETURN OLD._oada_rev
        `
      )
      .call('next');
  } else {
    return hasObj.rev;
  }
}

module.exports = {
  lookupFromUrl,
  getResource,
  getResourceOwnerIdRev,
  putResource,
  deleteResource,
  deletePartialResource,
  getParents,
  getNewDescendants,
  getChanges,
  makeRemote,
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
