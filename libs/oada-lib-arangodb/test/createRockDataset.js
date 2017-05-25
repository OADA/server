'use strict'
let _ = require('lodash');
let Promise = require('bluebird')
const config = require('../config')
config.set('isTest', true)
let resources = config.get('arangodb:collections:resources')
let graphNodes = config.get('arangodb:collections:graphNodes') 
let edges = config.get('arangodb:collections:edges')
/*
  /resources/6/rocks/rocks-index/123

  Resources:
  {
    _id: 6,
    _oada_rev: "0-0",
    _meta: {
      _id: "meta:6",
      _rev: "0-0"
    },
    picked_up: false
  }

  graphNodes:
  {
    is_resources: true,    //false for non-resources
    resource_id: '6',      //non-resources reference their parent resource
    meta_id: 'meta:6',     //non-resources reference their parent resource meta id
    path: '',              //non-resources have the path into the resource, e.g., '/picked_up'
  }

*/

var rockRandNumber=1;
var createResource = function createResource(data) {
  data = _.merge({}, {_oada_rev: "0-0"}, data);
  return resources.save(data).then((resource)=> {
    var meta = {
      _meta: {
        _oada_rev: "0-0",
        _id: "meta:" + resource._key
      }
    }
    return resources.update(resource, meta)
    .then((result) => {
      result._meta = meta._meta
      return result 
    })
  });
}

var createRocks = function createRocks() {
  var rocks = [
    {
      picked_up: false,
      _key: '777'
    }
  ];
  return Promise.map(rocks, (rock)=>{
    return createResource(rock);
  });
}

var createGraphNode = function createGraphNode(resourceId, isResource, path, metaId) {
  isResource = (isResource == null || isResource) ? true : false;
  var data = _.merge({}, {resource_id: resourceId, is_resource: isResource, path, meta_id: metaId});
  if (isResource) data._key = resourceId
  return graphNodes.save(data);
}

var addRocksData = function addRockData() {
  return createRocks().then(function(rocks) {
    return Promise.map(rocks, function(rock) {
      //Create graph node for each rock
      return createGraphNode(rock._key, true, '', rock._meta._id);
    }).then((gNodes)=>{
      //Create 'Rocks' resource
      var rocksResource = {
        'rocks-index': {},
        _key: '123'
      };
      _.forEach(rocks, function(rock) {
        rocksResource['rocks-index'][rockRandNumber] = {
          _id: rock._key
        }
        rockRandNumber++;
      });
      return createResource(rocksResource).then((rocksResourceSaved) => {
        rocksResource = _.merge({}, rocksResource, rocksResourceSaved);
        //Create resource for bookmarks
        var a = createResource({_key: '6', rocks: {_id: rocksResource._id}}).then(function(r) {
          //Create gNode for bookmarks
          return createGraphNode(r._key, true, '', r._meta._id);
        });
        //Create gNode for rocksResource
        var b = createGraphNode(rocksResource._key, true, '', rocksResource._meta._id);

        var rocksResourceGnode;
        var c = Promise.all([a,b]).spread(function(aNode, rocksResourceGnode) {
          //Create 'rocks-index' gNode
          var d = createGraphNode(rocksResource._key, false, '/rocks-index', rocksResource._meta._id).then((rockIndexGnode)=> {
            //Create edge for rocks resource to rocksIndex resource
            return edges.save({
              _to: rockIndexGnode._id,
              _from: rocksResourceGnode._id,
              name: 'rocks-index'
            }).then(function() {
              //Create edges for rocks
              return Promise.map(gNodes, function(rockGnode) {
                var m = _.findKey(rocksResource['rocks-index'], rockGnode.resource_id);
                return edges.save({
                  _to: rockGnode._id,
                  _from: rockIndexGnode._id,
                  name: m 

                })
              });
            });
          });
          //Create link from aNode to bNode with name: rocks
          return edges.save({
            _to: rocksResourceGnode._id,
            _from: aNode._id,
            name: 'rocks'
         })
        });
        return Promise.all([c]);
      })
    });
  }).catch((err) => {
    console.log('~~~~~~~~~~~~~~~~~~~~')
    console.log('~~~~~~~~~~~~~~~~~~~~')
    console.log('~~~~~~~~~~~~~~~~~~~~')
    console.log('~~~~~~~~~~~~~~~~~~~~')
    console.log('ERROR ', err) 
  })
}

var addData = function addData() {

  return createDb.destroy().then(() => {
    return createDb.create();
  }).then(()=> {
    return addRocksData()
  });
}

if (require.main === module) {
  console.log('Adding Dataset1 to the database.');
  return addData();
}
module.exports = {
  addData,
  addRocksData
};
