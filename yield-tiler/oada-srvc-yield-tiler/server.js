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
const {resources, remoteResources} = require('../../libs/oada-lib-arangodb');
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
let COUNTER = 0;

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
	queue(req)
  return undefined
})

let queue = cq().limit({concurrency: 1}).process(async function indexYield(req) { 

	let id = req['resource_id'];

	let orev = req['_orev'];
	trace('PATH', id)
	let resources = await recursiveGet([], id, {'_rev': orev}, 0)
	trace('RESOUCES', resources.length)
	//	let resources = await resources.getChanges(id, orev||'0-0')

	// Loop through all resources, changes, and data points
	return Promise.map(resources, (resource) => {
		trace('resource', resource.change.data)
		return Promise.map(Object.keys(resource.change.data || {}), (key) => {
			COUNTER++;
			let pt = resource.change.data[key];
			//TODO: handle multiple added data points
			//TODO: handle added geohashash buckets (no data points yet)

			let cropType = 'corn'
			return oadaLib.users.findById(req.user_id).then((user) => {
				return Promise.map([1,2,3,4,5,6,7], (ghLength) => {
					// 1) Find the data point's geohash of length ghLength
					let bucket = gh.encode(pt.location.lat, pt.location.lon, ghLength)
					let aggregate = gh.encode(pt.location.lat, pt.location.lon, ghLength+2)

					// 2) GET Current geohash bucket values
					let bucketPath = '/harvest/tiled-maps/dry-yield-map/crop-index/'+cropType+'/geohash-length-index/geohash-'+ghLength.toString()+'/geohash-index/'+bucket
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
							trace('YIELD TILER PATH A', bucketPath)
							return axios({
								method: 'PUT',
								url: 'http://http-handler/bookmarks'+bucketPath,
								headers: {
									//TODO: Don't hardcode this
									Authorization: 'Bearer def',
									'x-oada-bookmarks-type': 'tiled-maps',
									'Content-Type': 'application/vnd.oada.harvest.1+json'
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
						trace('YIELD TILER PATH B')
						return oadaLib.resources.getResource(result.resource_id).then((res) => {
							trace('B Path id', res._id)
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
										'Content-Type': 'application/vnd.oada.harvest.1+json'
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
										'Content-Type': 'application/vnd.oada.harvest.1+json'
									},
									data: {
										'geohash-data': {
											[aggregate]: additionalStats,
										},
										'stats': additionalStats
									}
								})
							}
						})
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

/*
let recursiveGet = function(resArray, path, rev, stuff, depth) {
	if (depth > 7) {
		resArray.push(stuff)
		return 
	}
	depth++;
	return Promise.map(Object.keys(stuff) || {}, (key) => {
		//1. trim oada-reserved keys _rev, _meta, _type
		if (key === '_type' || key === '_rev' || key === '_meta') return
		if (stuff[key]._rev) {
			//get the merge document
			return axios({
				method: 'GET',
				url: 'http://http-handler/'+path+'/_meta/_changes/'+stuff[key]._rev,
				headers: {
					Authorization: req.get('Authorization')
				},
			}).then((result) => {
				//can't assume a merge key exists
				if (result.data.merge) {
					return recursiveGet(resArray, path+'/'+key, stuff[key]._rev, result.data.merge, depth)
				}
				return
			})
		}
		return recursiveGet(resArray, path+'/'+key, rev, stuff[key], depth)
	})
}
*/



		


let recursiveGet = async function(resArray, path, stuff, depth) {
	//	if (depth > 10) return resArray
	if (typeof stuff === 'string') {
		return resArray
	}
	if (stuff._rev) {
		return axios({
			method: 'GET',
			url: 'http://http-handler/'+path+'/_meta/_changes/'+stuff._rev,
			headers: {
				Authorization: 'Bearer def',// req.get('Authorization')
			},
		}).then((result) => {
			if (depth >= 8) {
				if (result.data.merge) {
					resArray.push({change: result.data.merge})
				}
				return resArray
			}
			//can't assume a merge key exists
			if (result.data.merge) {
				depth++;
				return Promise.map(Object.keys(result.data.merge || {}), (key) => {
					if (key === '_type' || key === '_rev' || key === '_meta') return
					return recursiveGet(resArray, path+'/'+key, result.data.merge[key], depth).then((res) => {
						return
					})
				}).then(() => {
					return resArray
				})
			}
			return resArray
		})
	}
	depth++
	return Promise.map(Object.keys(stuff || {}), (key) => {
		//if (key === '_type' || key === '_rev' || key === '_meta') return
		return recursiveGet(resArray, path+'/'+key, stuff[key], depth).then((res) => {
			return resArray
		})
	}).then(() => {
		return resArray
	})
}
