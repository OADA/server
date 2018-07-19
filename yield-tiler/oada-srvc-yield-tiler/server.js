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
const tradeMoisture = {
  soybeans:  13,
  corn: 15,
  wheat: 13,
};
const cq = require('concurrent-queue');

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
    console.log('queueing');
		queue(req)
	}
	return undefined
})

let queue = cq().limit({concurrency: 1}).process(async function indexYield(req) { 
	info('processing', req)

  let id = req['resource_id'];
  let change;
  try {
    change = await changes.getRootChange(req.resource_id, req._rev);
  } catch(err) {
    console.log('uh oh', err)
    throw err
  }

  return Promise.map(Object.keys(change.body.data || {}), (key) => {
    let pt = change.body.data[key];
    console.log(change.body._context);
		let cropType = change.body._context['crop-index'];
    return oadaLib.users.findById(req.user_id).then((user) => {
			return Promise.map([1,2,3,4,5,6,7], (ghLength) => {
				// 1) Find the data point's geohash of length ghLength
				let bucket = gh.encode(pt.location.lat, pt.location.lon, ghLength)
				let aggregate = gh.encode(pt.location.lat, pt.location.lon, ghLength+2)

				// 2) GET Current geohash bucket values
				let bucketPath = '/harvest/tiled-maps/dry-yield-map/crop-index/'+cropType+'/geohash-length-index/geohash-'+ghLength.toString()+'/geohash-index/'+bucket;
				return oadaLib.resources.lookupFromUrl('/'+user.bookmarks._id+bucketPath, req.user_id).then((result) => {

					let template = {
						area: { units: 'acres' },
						weight: { units: 'bushels' },
						moisture: {
							units: '%H2O',
							value: tradeMoisture[cropType]
						},
						location: { datum: 'WGS84' },
					}
					let templateId = md5(JSON.stringify(template));

					let weight = pt.weight;
					if (pt.moisture > tradeMoisture[cropType]) {
						weight = weight*(100-pt.moisture)/(100-tradeMoisture[cropType]);// Adjust weight for moisture content
					}

					let additionalStats = {
						count: 1,
						weight: {
							sum: weight,
							'sum-of-squares': Math.pow(weight, 2),
						},
						'yield-squared-area': Math.pow(weight/pt.area, 2)*pt.area,
						area: {
							sum: pt.area,
							'sum-of-squares': Math.pow(pt.area, 2)
						},
						'sum-yield-squared-area': Math.pow(weight/pt.area, 2)*pt.area,
						template: templateId
					}

					// If the geohash resource doesn't exist, submit a deep PUT with the
					// additionalStats as the body
          if (result.path_leftover !== '') {
						return axios({
							method: 'PUT',
							url: 'http://http-handler/bookmarks'+bucketPath,
							headers: {
								//TODO: Don't hardcode this
								Authorization: 'Bearer def',
								'x-oada-bookmarks-type': 'tiled-maps',
								'Content-Type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json'
							},
							data: {
								'geohash-data': {
									[aggregate]: additionalStats,
								},
								stats: additionalStats
							},
						})
					}

					//Else, get the resource and update it.
					return oadaLib.resources.getResource(result.resource_id).then((res) => {
						if (res['geohash-data'][aggregate]) {
							// increment/compute new geohash bucket values
							//TODO: should probably check that they use the same template
							let data = {
								'geohash-data': {
									[aggregate]: recomputeStats(res['geohash-data'][aggregate], additionalStats),
								},
								stats: recomputeStats(res.stats, additionalStats)
							}
							return axios({
								method: 'PUT',
								url: 'http://http-handler/bookmarks'+bucketPath,
								headers: {
									Authorization: 'Bearer def',
									'x-oada-bookmarks-type': 'tiled-maps',
									'Content-Type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json'
								},
								data,
							})
						} else {
							// new aggregate. Push stats
							return axios({
								method: 'PUT',
								url: 'http://http-handler/bookmarks'+bucketPath,
								headers: {
									Authorization: 'Bearer def',
									'x-oada-bookmarks-type': 'tiled-maps',
									'Content-Type': 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json'
								},
								data: {
									'geohash-data': {
										[aggregate]: additionalStats,
									},
									stats: recomputeStats(res.stats, additionalStats)
								}
							})
						}
					})
				})
			})
		})
	})
})

let recomputeStats = function(currentStats, additionalStats) {
  currentStats.count = currentStats.count + additionalStats.count;
  currentStats.area.sum = currentStats.area.sum + additionalStats.area.sum;
  currentStats.area['sum-of-squares'] = currentStats.area['sum-of-squares'] + additionalStats.area['sum-of-squares'];
  currentStats.weight.sum = currentStats.weight.sum + additionalStats.weight.sum;
  currentStats.weight['sum-of-squares'] = currentStats.weight['sum-of-squares'] + additionalStats.weight['sum-of-squares'];
  currentStats['sum-yield-squared-area'] = currentStats['sum-yield-squared-area'] + additionalStats['sum-yield-squared-area'];
  return currentStats;
};
