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
 * limitations under the License.
 */

'use strict';

const debug = require('debug');
const warn = debug('winfield-fields-sync:trace');
const trace = debug('winfield-fields-sync:trace');
const info = debug('winfield-fields-sync:info');
const error = debug('winfield-fields-sync:error');

const Promise = require('bluebird');
const {Responder} = require('../../libs/oada-lib-kafka');
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const uuid = require('uuid');
const axios = require('axios')
const awsSign = require('aws-v4-sign-small').sign;
const datasilo = require('./datasilo');
const wicket = require('wicket');
const moment = require('moment');
const cq = require('concurrent-queue');
const cache = require('@oada/oada-cache');
const tree = {
  'bookmarks': {
    '_type': "application/vnd.oada.bookmarks.1+json",
    '_rev': '0-0',
    'fields': {
      '_type': "application/vnd.oada.fields.1+json",
      '_rev': '0-0',
      'fields-index': {
        '*': {
          '_type': "application/vnd.oada.field.1+json",
          '_rev': '0-0',
          'fields-index': {
            '*': {
              '_type': "application/vnd.oada.field.1+json",
              '_rev': '0-0',
            }
          }
        }
      }
    }
  }
}

var services = {
  'bookmarks': {
    '_type': "application/vnd.oada.bookmarks.1+json",
    '_rev': '0-0',
    'services': {
      '_type': 'application/vnd.oada.services.1+json',
      '_rev': '0-0',
      'datasilo': {
        '_type': 'application/vnd.oada.services.1+json',
        '_rev': '0-0',
      }
    }
  }
}

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder({
	consumeTopic: config.get('kafka:topics:httpResponse'),
	group: 'winfield-fields-sync',
});

module.exports = function stopResp() {
    return responder.disconnect();
};

// LISTEN FOR WRITES TO RESOURCES WITH _TYPE 'application/vnd.oada.fields.1+json'
responder.on('request', async function handleReq(req) {
	if (req.msgtype !== 'write-response') return
	if (req.code !== 'success') return
  if (req.contentType === 'application/vnd.oada.fields.1+json') queue(req)
	return
})

var intervalTime = 2;
var beginning = moment().subtract(4, 'years').format('ddd, DD MMM YYYY HH:mm:ss +0000');
var since = moment().subtract(4, 'years').format('ddd, DD MMM YYYY HH:mm:ss +0000');
var _rev = '0-0';
var CONNECTION;

cache.default.connect({
  domain: 'http://http-handler',
  token: 'def',
  cache: false,
  //noWebsocket: true,
}).then((result) => {
  CONNECTION = result
  checkWinfieldFields()
  setInterval(checkWinfieldFields, intervalTime*1000)
})

async function checkGrower(grower, user) {
  var growerId = grower.id.toString().replace(/^users\//, '');
  let growerLookup = await oadaLib.resources.lookupFromUrl(`/bookmarks/services/datasilo/grower_id`, user)
  console.log('growerLookup', growerLookup)
  if (growerLookup && growerLookup.path_leftover === '/grower_id') {
    if (grower.status !== 'deleted') {
      //      let grower = await oadaLib.resources.getResource(growerLookup.resource_id);
      // Compare for edits
    } else if (grower.status === 'deleted') {
      console.log('checkGrower deleted')
      await CONNECTION.delete({
        path: `/bookmarks/services/datasilo`,
      })     
    }
  } else { //if (grower.status === 'added') {
    //Create the services
    console.log('checkGrower PUT', growerId)
    await CONNECTION.put({
      tree: services,
      path: `/bookmarks/services/datasilo`,
      data: {
        grower_id: grower.id
      }
    })
  }
}

async function checkField(field, farm, farm_id, user, grower_id) {
  var farmKey = farm_id.replace(/^resources\//, '')
  var field_id;
  var fieldKey;
  var fieldKey;
  var boundary_id;
  console.log('IDENTIFIER', field.identifier)
  if (field.identifier && field.identifier['OADAPOC-field-ID']) {
    field_id = field.identifier['OADAPOC-field-ID'];
    fieldKey = field_id.replace(/^resources\//, '');
  } else {
    fieldKey = uuid();
    field_id = 'resources/'+fieldKey;
    boundary_id = field_id+'_boundary';
    await datasilo.put('alias/'+field.id.toString(), {
      identifier: field_id
    })
    await datasilo.put('alias/'+field.boundary[0].id.toString(), {
      identifier: boundary_id,
    })
  }
  let fieldLookup = await oadaLib.resources.lookupFromUrl(`/bookmarks/fields/fields-index/${farmKey}/fields-index/${fieldKey}`, user)
  if (fieldLookup && fieldLookup.path_leftover === '') {
    if (field.status === 'active' || field.status === 'added') {
      let oadaField = await oadaLib.resources.getResource(fieldLookup.resource_id);
      console.log('OADAFIELD', oadaField)
      /*
      if (!field.boundary[0].identifier || !field.boundary[0].identifier['OADAPOC-boundary-ID']) {
        await datasilo.put('alias/'+field.boundary[0].id, {
          identifier: oadaField._id+'_boundary'
        })
      }*/

      //compare content for edits
      var oadaFieldData = {
        name: oadaField.name,
        boundary: oadaField.boundary,
        _id: oadaField._id,
        _context: oadaField._context
      }
      var data = {
        name: field.name,
        boundary: field.boundary ? {geojson: (new wicket.Wkt(field.boundary[0].boundary)).toJson()} : oadaField.boundary,
        _id: field_id,
        _context: {
          farm: farm_id
        }
      }
      if (field.boundary && field.boundary.geojson.coordinates) {
        field.boundary.geojson.coordinates[0].pop()
      }

      if (JSON.stringify(data) !== JSON.stringify(oadaFieldData)) {
        console.log('FIELDS ARE DIFFERENT', oadaFieldData, data)
        await CONNECTION.put({
          tree,
          path: `/bookmarks/fields/fields-index/${farmKey}/fields-index/${fieldKey}`,
          data
        })
      }
      // This happens when we create it in OADA but do not create _meta entry
      if (!oadaField._meta.datasilo) {
        console.log('checkField META MISSING PUT', field_id, field.boundary[0])
        await CONNECTION.put({
          tree,
          path: `/bookmarks/fields/fields-index/${farmKey}/fields-index/${fieldKey}/_meta`,
          data: {
            datasilo: {
              field_id,
              boundary_id: field_id+'_boundary',
            }
          },
        })
      }
  } else if (field.status === 'deleted') {
      console.log('checkField DELETED', field_id)
      await CONNECTION.delete({
        path: `/bookmarks/fields/fields-index/${farmKey}/fields-index/${fieldKey}`,
      })
    }
  } else if (field.status === 'active' || field.status === 'added') {
    // Can assume it hasn't yet been synched to OADA. Create resource,
    // and meta info.
    console.log('checkField PUT with META', field_id)
    await CONNECTION.put({
      tree,
      path: `/bookmarks/fields/fields-index/${farmKey}/fields-index/${fieldKey}`,
      data: {
        name: field.name,
        boundary: {geojson: (new wicket.Wkt(field.boundary[0].boundary)).toJson()},
        _id: field_id,
        _context: {
          farm: farm_id
        },
        _meta: {
          datasilo: {
            field_id,
            boundary_id
          }
        }
      }
    })
  }
}

async function checkFarm(farm, user, grower_id) {
  var farm_id;
  var farmKey;
  if (farm.identifier && farm.identifier['OADAPOC-farm-ID']) {
    farm_id = farm.identifier['OADAPOC-farm-ID'];
    farmKey = farm_id.replace(/^resources\//, '');
  } else {
    farmKey = uuid()
    farm_id = 'resources/'+farmKey;
    console.log('checkFarm creating alias', farm_id)
    await datasilo.put('alias/'+farm.id.toString(), {
      identifier: farm_id
    })
  }
  let farmLookup = await oadaLib.resources.lookupFromUrl(`/bookmarks/fields/fields-index/${farmKey}`, user)
  if (farmLookup && farmLookup.path_leftover === '') {
    if (farm.status === 'active' || farm.status === 'added') {
      let oadaFarm = await oadaLib.resources.getResource(farmLookup.resource_id);
      console.log("OADAFARM", oadaFarm)
      // Compare for edits
      var oadaFarmData = {
        name: oadaFarm.name,
        _id: oadaFarm._id,
      }
      var data = {
        name: farm.name,
        _id: farm_id,
      }
      if (JSON.stringify(data) !== JSON.stringify(oadaFarmData)) {
        console.log('FARMS ARE DIFFERENT', oadaFarmData, data)
        await CONNECTION.put({
          tree,
          path: `/bookmarks/fields/fields-index/${farmKey}`,
          data,
        })
      }
      // This happens when we create it in OADA but do not create _meta entry
      if (!oadaFarm._meta.datasilo) {
        console.log('checkFarm META MISSING PUT', farm_id)
        await CONNECTION.put({
          tree,
          path: `/bookmarks/fields/fields-index/${farmKey}/_meta`,
          data: {
            datasilo: {
              farm_id,
            }
          }
        })
      }
    } else if (farm.status === 'deleted') {
      console.log('checkFARM DELETE', farm_id)
      await CONNECTION.delete({
        path: `/bookmarks/fields/fields-index/${farm_id}`,
      })     
    }
  } else if (farm.status === 'active' || farm.status === 'added') {
    //Create the farm, and _meta
    console.log('checkFARM PUT', farm_id)
    await CONNECTION.put({
      tree,
      path: `/bookmarks/fields/fields-index/${farmKey}`,
      data: {
        name: farm.name,
        _id: farm_id,
        _meta: {
          datasilo: {
            farm_id
          }
        }
      }
    })
  }
  return farm_id
}

// Get grower info since the last ping time (5 seconds)
function checkWinfieldFields() {
  var path = 'grower'
  var query = {expand: 'farm,field,season,boundary'}
  var nextSince = moment().format('ddd, DD MMM YYYY HH:mm:ss +0000');
  datasilo.get(path, query, since).then(async function(res) {
    since = nextSince;
    console.log('~~~~~~~~~~~~~~~CHECK GROWER~~~~~~~~~~~~~~~~')
    await checkGrower(res.data[0], 'users/default:users_sam_321')
    console.log('~~~~~~~~~~~~~~~CHECK GROWER DONE~~~~~~~~~~~~~~~~')
    //var farm = res.data[0].farm[0]
    Promise.map(res.data[0].farm || [], async function(farm) {
      console.log('~~~~~~~~~~~~~~~CHECK FARM~~~~~~~~~~~~~~~~', farm.name)
      var farmId = await checkFarm(farm, 'users/default:users_sam_321', res.data[0].id)
      console.log('~~~~~~~~~~~~~~~CHECK FARM DONE~~~~~~~~~~~~~~~~', farm.name)
      Promise.map(farm.field || [], async function(field) {
        console.log('~~~~~~~~~~~~~~~CHECK FIELD~~~~~~~~~~~~~~~~', field.name)
        await checkField(field, farm, farmId, 'users/default:users_sam_321', res.data[0].id)
        console.log('~~~~~~~~~~~~~~~CHECK FIELD DONE~~~~~~~~~~~~~~~~', field.name)
      })
    }, {concurrency: 1})
  }).catch((err) => {
    console.log(err)
    since = nextSince;
  })
}

/*
function getOadaStuff(resource_id) {
  var fields = {'fields-index': {}};
  return oadaLib.resources.getResource(resource_id).then((result) => {
    return Promise.map(object.keys(result['fields-index'] || {}), (farmName) => {
      return oadaLib.resources.getResource(result['fields-index'][farmName]._id).then(async function(farm) {
        fields['fields-index'][farmName] = farm;
        let farmMeta = await oadaLib.resources.getResource(result['fields-index'][farmName]+'/_meta')
        fields['fields-index'][farmName]._meta = farmMeta;
        return Promise.map(object.keys(res['fields-index'] || {}), (fieldName) => {
          return oadaLib.resources.getResource(res['fields-index'][fieldName]._id).then(async function(field) {
            let fieldMeta = oadaLib.resources.getResource(res['fields-index'][fieldName]+'/_meta')
            return fields['fields-index'][farmName]['fields-index'][fieldName]._meta = fieldMeta;
          })
        })
      })
    })
  }).then(() => {
    return fields
  })
}

function checkOadaFields() {
  // Get the _rev of oada
  return oadaLib.resources.lookupFromUrl('/bookmarks/fields', req.user_id).then((result) => {
    if (_rev !== result.rev) {
      _rev = result.rev;
      var datasiloStuff = await datasilo.get(path, query, beginning)
      var oadaStuff = getOadaStuff(result.resource_id);
      compareOadaDataSilo(oadaStuff, datasiloStuff.data)
    }
  })
}*/

function oadaToDataSiloFarm(farmChange, oadaFarm, grower_id, farm_id) {
  var dsFarm = {
    grower_id,
    farm_id,
    name: farmChange.name || oadaFarm.name,
  }
  if (oadaFarm.tags || farmChange.tags) dsFarm.tags = farmChange.tags || oadaFarm.tags;
  return dsFarm
}

function oadaToDataSiloField(fieldChange, oadaField, grower_id, farm_id, field_id) {
  var dsField = {
    grower_id,
    farm_id,
    field_id,
    name: oadaField.name,
  }
  if (oadaField.tags || fieldChange.tags) dsField.tags = fieldChange.tags || oadaField.tags;
  return dsField
}

function oadaToDataSiloBoundary(oadaField, grower_id, farm_id, field_id, boundary_id) {
  if (!(oadaField.boundary && oadaField.boundary.geojson)) return
  var geojson = oadaField.boundary.geojson
  if (geojson.coordinates && JSON.stringify(geojson.coordinates[0][0]) !== JSON.stringify(geojson.coordinates[0][geojson.coordinates[0].length-1])) {
    geojson.coordinates[0].push(geojson.coordinates[0][0])
  }
  var wkt = new wicket.Wkt();
  var dsBoundary = {
    grower_id,
    farm_id,
    parent_id: field_id,
    boundary_id,
    field_id,
    name: oadaField.name+'_boundary',
    boundary: wkt.read(JSON.stringify(geojson)).write()
  }
  // Handle optional keys
  if (oadaField.season) dsBoundary.season = oadaField.season;
  if (oadaField.acres) dsBoundary.acres = oadaField.acres;
  if (oadaField.sum_acres) dsBoundary.sum_acres = oadaField.sum_acres;
  if (oadaField.failure_acres) dsBoundary.failure_acres = oadaField.failure_acres;
  if (oadaField.imported_acress) dsBoundary.imported_acres = oadaField.imported_acres;
  return dsBoundary
}

var queue = cq().limit({concurrency: 1}).process(async function handleFieldChange(req) {
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  console.log('GOT ONE!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
  var id = req['resource_id'];
  var change;
  let grower_id;
  try {
    change = await oadaLib.changes.getChange(req.resource_id, req._rev);
    console.log('CHANGE', change.body)
    let growerLookup = await oadaLib.resources.lookupFromUrl(`/bookmarks/services/datasilo`, req.user_id)
    if (!growerLookup || growerLookup.path_leftover !== '') return
    let grower = await oadaLib.resources.getResource(growerLookup.resource_id);
    grower_id = grower.grower_id;
  } catch(err) {
    //TODO: HANDLE GROER INFO MISSING IN OADA wi
    var beginning = moment().subtract(4, 'years').format('ddd, DD MMM YYYY HH:mm:ss +0000');
    var path = 'grower'
    let growerData = await datasilo.get(path, {}, beginning)
    grower_id = growerData.data[0];
    await checkGrower(grower_id, 'users/default:users_sam_321')
    console.log(err)
    throw err
  }

  return Promise.map(Object.keys(change.body['fields-index'] || {}), async function(farmKey) {
    // Handle farm addition/change
    let farmLookup = await oadaLib.resources.lookupFromUrl(`/bookmarks/fields/fields-index/${farmKey}`,req.user_id)
    console.log('FARM LOOKUP', farmLookup)
    if (farmLookup && farmLookup.path_leftover === '') {
      var oadaFarm = await oadaLib.resources.getResource(farmLookup.resource_id);
      var farmChange = change.body['fields-index'][farmKey];
      var farm_id = oadaFarm._id;
      console.log('OADAFARM', JSON.stringify(oadaFarm))
      console.log('FARMCHANGE', JSON.stringify(farmChange))
      if (farmChange.name || farmChange._id) {
        var dsFarm = oadaToDataSiloFarm(farmChange, oadaFarm, grower_id, farm_id)
        var dsRequest = oadaFarm._meta.datasilo && oadaFarm._meta.datasilo.farm_id ? datasilo.put : datasilo.post;
        console.log('FARM REQUEST', dsFarm)
        await dsRequest('farm', dsFarm)
      }
      return Promise.map(Object.keys(change.body['fields-index'][farmKey]['fields-index'] || {}), async function(fieldKey) {
        //Handle field, boundary addition/change
        let fieldLookup = await oadaLib.resources.lookupFromUrl(`/bookmarks/fields/fields-index/${farmKey}/fields-index/${fieldKey}`,req.user_id)
        if (fieldLookup && fieldLookup.path_leftover === '') {
          let oadaField = await oadaLib.resources.getResource(fieldLookup.resource_id);
          let fieldChange = change.body['fields-index'][farmKey]['fields-index'][fieldKey];
          console.log('OADA FIELD', JSON.stringify(oadaField))
          console.log('FIELD CHANGE', JSON.stringify(fieldChange))
          var field_id = oadaField._id;
          let dsField = oadaToDataSiloField(fieldChange, oadaField, grower_id, farm_id, field_id);
          var dsReq = oadaField._meta.datasilo && oadaField._meta.datasilo.field_id ? datasilo.put : datasilo.post;
          console.log('OADA FIELD', oadaField)
          console.log('FIELD CHANGE', fieldChange)
          console.log('FIELD REQUEST2', dsField)
          await dsReq('field', dsField)
          console.log('BOUNDARY!!!!', fieldChange.boundary)
          if (fieldChange.boundary) {
            var boundary_id = oadaField._id+'_boundary';
            let dsBoundary = oadaToDataSiloBoundary(oadaField, grower_id, farm_id, field_id, boundary_id);
            console.log('BOUNDARY REQUEST', dsBoundary)
            await dsReq('boundary', dsBoundary)
          }
        }
        return
      })
    } else return
  }).catch((err) => {
    console.log(err)
  })
})
