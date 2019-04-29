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


/* A change was made to the /bookmarks/harvest/as-harvested/ resource. Use
 * a db query to return one or more new data points. Then, identify all of
 * the appropriate geohash buckets the point needs to be added to. If the 
 * bucket resource doesn't exist, create it (as well as any other preceding
 * resources). Compute new stats for the bucket and aggregate. Submit this 
 * array of writes to the write handler
 */
'use strict';

const debug = require('debug');
const info = debug('yield-tiler:info');
const trace = debug('yield-tiler:trace');
const warn = debug('yield-tiler:warn');
const error = debug('yield-tiler:error');

const Promise = require('bluebird');
const URL = require('url');
const oadaLib = require('../../libs/oada-lib-arangodb');
const {Responder} = require('../../libs/oada-lib-kafka');
const {resources, changes, remoteResources} = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const axios = require('axios');
const gh = require('ngeohash');
const md5 = require('md5');
const pointer = require('json-pointer');
const uuid = require('uuid');
const _ = require('lodash');
const cq = require('concurrent-queue');

const tradeMoisture = {
  soybeans:  13,
  corn: 15,
  wheat: 13,
};
var yieldMoistureDatasetRev = 0;

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder({
	consumeTopic: config.get('kafka:topics:httpResponse'),
	group: 'yield-tiler'
});

module.exports = function stopResp() {
    return responder.disconnect();
};

responder.on('request', async function handleReq(req) {
	if (req.msgtype !== 'write-response') {
    return;
  }
	if (req.code !== 'success') {
	  return;
  }
  if (req.contentType === 'application/vnd.oada.as-harvested.1+json') {
		queue(req)
	}
	return undefined
})

var queue = cq().limit({concurrency: 1}).process(async function indexYield(req) {

  var id = req['resource_id'];
  var change;
  try {
    change = await changes.getRootChange(req.resource_id, req._rev);
  } catch(err) {
    throw err
  }
  if (change.type === 'delete') {
    return
    //    return handleDelete(req, change)
  }
  return oadaLib.users.findById(req.user_id).then((user) => {
    return Promise.map([1,2,3,4,5,6,7], async function(ghLength) {
      console.log(change.body)
      if (!change.body || !change.body._context) return
      var crop = change.body._context['crop-index'];
      // 1) Find the data point's geohash of length ghLength
      var bucket = change.body._context['geohash-index'].slice(0, ghLength)

      // 2) GET Current geohash bucket values
      var bucketPath = '/harvest/tiled-maps/dry-yield-map/crop-index/'+crop+'/geohash-length-index/geohash-'+ghLength.toString()+'/geohash-index/'+bucket;
      var result = await oadaLib.resources.lookupFromUrl('/'+user.bookmarks._id+bucketPath, req.user_id)
      return Promise.map(Object.keys(change.body.data || {}), async function(key) {
        var pt = change.body.data[key];
        var aggregate = gh.encode(pt.location.lat, pt.location.lon, ghLength+2)
        var template = {
          area: { units: 'acres' },
          weight: { units: 'bushels' },
          moisture: {
            units: '%H2O',
            value: tradeMoisture[crop]
          },
          location: { datum: 'WGS84' },
        }
        var templateId = md5(JSON.stringify(template));

        var weight = pt.weight;
        if (pt.moisture > tradeMoisture[crop]) {
          weight = weight*(100-pt.moisture)/(100-tradeMoisture[crop]);// Adjust weight for moisture content
        }

        var stats = {
          count: 1,
          weight: {
            sum: weight,
            'sum-of-squares': Math.pow(weight, 2),
          },
          'yield-squared-area': Math.pow(weight/pt.area, 2)*pt.area,
          area: {
            sum: pt.area,
            'sum-of-squares': Math.pow(pt.area, 2),
          },
          'sum-yield-squared-area': Math.pow(weight/pt.area, 2)*pt.area,
          template: templateId
        }

        // If the geohash resource doesn't exist, submit a deep PUT with the
        // additionalStats as the body
        var data = {
          _context: {
            'crop-index': crop,
            'tiled-maps': 'dry-yield-map',
            'geohash-length-index': 'geohash-'+bucket.length,
            'geohash-index': aggregate
          }
        }
        if (result.path_leftover !== '') {
          data['geohash-data'] = {[aggregate]: stats}
          data.stats = stats
        } else {
          //Else, get the resource and update it.
          var res = await oadaLib.resources.getResource(result.resource_id)
          //TODO: should probably check that they use the same template
          data['geohash-data'] = {[aggregate]: recomputeStats(res['geohash-data'][aggregate], stats)};
          data.stats = recomputeStats(res.stats, stats)
        }
        console.log('PUT', bucketPath)
        return axios({
          method: 'PUT',
          url: 'http://http-handler/bookmarks'+bucketPath,
          headers: {
            //TODO: Don't hardcode this
            Authorization: 'Bearer def',
            'x-oada-bookmarks-type': 'tiled-maps',
            'Content-Type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json'
          },
          data
        })
			})
		})
  }).catch((err) => {
    console.log('!!!!!!')
    console.log('!!!!!!')
    console.log('!!!!!!')
    console.log(err)
  })
})

var recomputeStats = function(currentStats, additionalStats, factor) {
  factor = factor || 1;
  // Handle when whole thing is undefined
  currentStats = currentStats || {
    count: 0,
    weight: {
      sum: 0, 
      'sum-of-squares': 0,
    },
    'yield-squared-area': 0,
    area: {
      sum: 0,
      'sum-of-squares': 0,
    },
    'sum-yield-squared-area': 0,
  }
  // Handle parts that are undefined
  currentStats.count = currentStats.count || 0;
  currentStats.area = currentStats.area || {};
  currentStats.area.sum = currentStats.area.sum || 0;
  currentStats.area['sum-of-squares'] = currentStats.area['sum-of-squares'] || 0;
  currentStats.weight = currentStats.weight || {};
  currentStats.weight.sum = currentStats.weight.sum || 0;
	currentStats.weight['sum-of-squares'] = currentStats.weight['sum-of-squares'] || 0;
  currentStats['sum-yield-squared-area'] = currentStats['sum-yield-squared-area'] || 0;

  //handle when additionalStats is undefined
  if (!additionalStats) return currentStats

  // Sum the two
  currentStats.count += additionalStats.count*factor;
  currentStats.area.sum += additionalStats.area.sum*factor;
  currentStats.area['sum-of-squares'] += additionalStats.area['sum-of-squares']*factor;
  currentStats.weight.sum += additionalStats.weight.sum*factor;
	currentStats.weight['sum-of-squares'] += additionalStats.weight['sum-of-squares']*factor;
  currentStats['sum-yield-squared-area'] += additionalStats['sum-yield-squared-area']*factor;

  //Handle negative values
  if (currentStats.count < 0) currentStats.count = 0;
  if (currentStats.area.sum < 0) currentStats.area.sum = 0;
  if (currentStats.area['sum-of-squares'] < 0) currentStats.area['sum-of-squares'] = 0;
  if (currentStats.weight.sum < 0) currentStats.weight.sum = 0;
  if (currentStats.weight['sum-of-squares'] < 0) currentStats.weight['sum-of-squares'] = 0;
  if (currentStats['sum-yield-squared-area'] < 0) currentStats['sum-yield-squared-area'] = 0;

  // Compute Yield
  currentStats.yield = {
    mean: currentStats.weight.sum/currentStats.area.sum,
    variance: currentStats['sum-yield-squared-area']/currentStats.area.sum,
  }
  currentStats.yield.standardDeviation = Math.pow(currentStats.yield.variance, 0.5);
  return currentStats;
};

async function handleDelete(req, change) {
  console.log('REQ', req)
  console.log('CHANGE', change)
  var asHarvestedPath = '/harvest/as-harvested/yield-moisture-dataset/crop-index/'+crop+'/geohash-length-index/geohash-7/geohash-index/'+bucket;
  var asHarvestedRes = await oadaLib.resources.getResource(resource_id)
  console.log('AS HARVEST RES', asHarvestedRes)
  if (!asHarvestedRes._context) return
  var crop = asHarvestedRes._context['crop-index'];
  var bucket = asHarvestedRes._context['geohash-index'];
  var asHarvestedPath = '/harvest/as-harvested/yield-moisture-dataset/crop-index/'+crop+'/geohash-length-index/geohash-7/geohash-index/'+bucket;
  console.log('PATHS', path, asHarvestedPath)
  return oadaLib.users.findById(req.user_id).then((user) => {
    // Whole thing was deleted
    var buckets = {
      stats: {},
      aggregates: {}
    }
    return Promise.map([1,2,3,4,5,6,7], (ghLength) => {
      return Promise.map(Object.keys(asHarvestedRes.data || []), (key) => {
        var bucketPath = '/harvest/tiled-maps/dry-yield-map/crop-index/'+crop+'/geohash-length-index/geohash-'+ghLength.toString()+'/geohash-index/'+bucket;
        var pt = asHarvestedRes.data[key];
        var aggregate = gh.encode(pt.location.lat, pt.location.lon, ghLength+2)
        var weight = pt.weight;
        if (pt.moisture > tradeMoisture[crop]) {
          weight = weight*(100-pt.moisture)/(100-tradeMoisture[crop]);// Adjust weight for moisture content
        }

        var stats = {
          count: 1,
          weight: {
            sum: weight,
            'sum-of-squares': Math.pow(weight, 2),
          },
          'yield-squared-area': Math.pow(weight/pt.area, 2)*pt.area,
          area: {
            sum: pt.area,
            'sum-of-squares': Math.pow(pt.area, 2),
          },
          'sum-yield-squared-area': Math.pow(weight/pt.area, 2)*pt.area,
        }

        buckets[bucketPath].stats = recomputeStats(buckets[bucketPath].stats, stats)
        buckets[bucketPath].aggregates[aggregate] = recomputeStats(buckets[bucketPath].aggregates[aggregate], stats);
        return
      })
    }).then(() => {
      console.log('HANDLEBUCKETS', user, buckets)
      return handleBuckets(buckets, user)
    })
  })
}

function handleBuckets(buckets, user) {
  return Promise.map(Object.keys(buckets || {}), async function(bucketPath) {
    var lookup = await oadaLib.resources.lookupFromUrl('/'+user.bookmarks._id+bucketPath, user._id)
    if (lookup.path_leftover !== '') return
    var res = await oadaLib.resources.getResource(lookup.resource_id)
    var data = {stats: recomputeStats(res.stats, buckets[bucketPath].stats, -1)}
    if (data.stats.count === 0) {
      console.log('Deleting', bucketPath)
      return axios({
        method: 'DELETE',
        url: 'http://http-handler/bookmarks'+bucketPath,
        headers: {
          //TODO: Don't hardcode this
          Authorization: 'Bearer def',
          'Content-Type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json'
        },
      })
    }
    return Promise.map(Object.keys(buckets[bucketPath].aggregates || {}), (aggregate) => {
      data['geohash-data'][aggregate] = recomputeStats(res['geohash-data'][aggregate], buckets[bucketPath].aggregates[aggregate], -1)
      console.log('PUTing', bucketPath, data)
      return axios({
        method: 'PUT',
        url: 'http://http-handler/bookmarks'+bucketPath,
        headers: {
          Authorization: 'Bearer def',
          'x-oada-bookmarks-type': 'tiled-maps',
          'Content-Type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json'
        },
        data
      })
    })
  })
}
