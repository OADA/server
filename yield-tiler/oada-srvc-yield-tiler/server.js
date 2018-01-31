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
const {ResponderRequester} = require('../../libs/oada-lib-kafka');
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

//---------------------------------------------------------
// Kafka intializations:
const responderRequester = new ResponderRequester({
		requestTopics: {
		produceTopic: config.get('kafka:topics:writeRequest'),
			},
		respondTopics: {
		consumeTopic: config.get('kafka:topics:httpResponse'),
			},
  group: 'yield-tiler'
});

let setupTree = {
	'harvest': {
		'_type': "application/vnd.oada.harvest.1+json",
		'tiled-maps': {
			'_type': "application/vnd.oada.tiled-maps.1+json",
			'dry-yield-map': {
				'_type': "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
				'crop-index': {
					'*': {
						"_type": "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
						'geohash-length-index': {
							'*': {              
								"_type": "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
								'geohash-index': {
									'*': {
										"_type": "application/vnd.oada.tiled-maps.dry-yield-map.1+json",
										"datum": "WGS84",
										"geohash-data": {},
										"stats": {},
										"templates": {}
									}
								}
							}
						}
					}
				}
			}
		}
	}
}

module.exports = function stopResp() {
    return responderRequester.disconnect();
};

responderRequester.on('request', async function handleReq(req) {

	if (req.msgtype !== 'write-response') {
    return;
  }
	if (req.code !== 'success') {
	  return;
	}
	trace('queueing up', req.resource_id)
	queue(req)
  return undefined
})

let queue = cq().limit({concurrency: 1}).process(async function indexYield(req) { 
	trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~')
	trace('running queue item with id:', req.resource_id)

	let id = req['resource_id'];

	let orev = req['_orev'];
	let desc = await resources.getChanges(id, orev||'0-0')

	let sharedTree = _.cloneDeep(setupTree)
	let writes = [];
	return Promise.map(desc, (change) => {
		return Promise.map(Object.keys(change.changes.merge.data || {}), (key) => {
			let pt = change.changes.merge.data[key];
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

						let write = {
							'resource_id': user.bookmarks._id+bucketPath,
							'path_leftover': '',
							'user_id': user._id,
							'contentType': 'application/vnd.oada.tiled-maps.dry-yield-map.1+json',
							'body': {
								'geohash-data': {
									[aggregate]: additionalStats
								},
								stats: additionalStats,
								templates: {
									[templateId]: template
								}
							}
						}

						// If the geohash resource doesn't exist, create it and put the data within
						if (result.path_leftover !== '') {
						  trace('YIELD TILER PATH A', bucketPath)
							return recursiveStuff(pointer.parse(bucketPath), 0, write.body, user, [], sharedTree).then((pathWrites) => {
								trace('return pathWrites', pathWrites)
								return pathWrites
							})
						}

						//Else, get the resource and update it.
						trace('YIELD TILER PATH B')
						return oadaLib.resources.getResource(result.resource_id).then((resource) => {
							trace('B Path id', resource._id)
							if (resource['geohash-data'][aggregate]) {
								// 3) increment/compute new geohash bucket values
								//TODO: should probably check that they use the same template
								write.resource_id = resource._id;
								write.body['geohash-data'][aggregate] = recomputeStats(resource['geohash-data'][aggregate], additionalStats)
								write.body.stats = recomputeStats(resource.stats, additionalStats)
							  trace('HERES TE BODY', write.body)
								return [write]
							} else {
								// new aggregate. Push stats
								return [write]
							}
						})
					})
				}, {concurrency: 1}).then((ghLengthWrites) => {
					ghLengthWrites.forEach(write => writes.push(...write))
					return writes
				})
			})
		}, {concurrency: 1}).then((ptWrites) => {
			ptWrites.forEach(write => writes.push(...write))
      return writes
		})
	}, {concurrency: 1}).then((changes) => {
		trace('..............................................')
		trace('changes.................................', changes)
		trace('..............................................')
		changes.forEach(write => writes.push(...write))
		//return writes
		return Promise.map(writes, (write) => {
			return responderRequester.send(write)
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

function replaceLinks(desc, example) {
  let ret = (Array.isArray(example)) ? [] : {};
  if (!desc) return example;  // no defined descriptors for this level
  Object.keys(example).forEach(function(key, idx) {
		if (key === '*') { // Don't put *s into oada. Ignore them 
			return;
		}
		let val = example[key];
    if (typeof val !== 'object' || !val) {
      ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
      return;
		}
		trace('key:',key,'val:', val, 'has _id', val._id ? true : false)
		if (val._id) { // If it's an object, and has an '_id', make it a link from descriptor
      ret[key] = { _id: desc[key]._id, _rev: '0-0' };
      return;
    }
    ret[key] = replaceLinks(desc[key],val); // otherwise, recurse into the object looking for more links
  });
  return ret;
}

function recursiveStuff(fullPathArray, i, data, user, writes, tree) {
	// If a * occurs at this position in the setupTree, replace current element
	// with a * so it can be checked against the setupTree
	let currentPathArray = fullPathArray.slice(0, i+1)
	let currentPath = pointer.compile(currentPathArray)
	let nextPiece = fullPathArray[i+1];
  let nextPathArray = fullPathArray.slice(0, i+2)
	if (nextPiece) {
	  trace('YIELD TILER AAAAAA')
		trace('has star?', pointer.has(tree, currentPath+'/*'), currentPath+'/*')
		//Update the tree by duplicating content below * for the nextPiece key
		//Its this copying of the * tree that can get us into trouble.
		if (pointer.has(tree, currentPath+'/*')) {
			let nextPath = pointer.compile(nextPathArray)
			trace('nextPath', nextPath)
			if (!pointer.has(tree, nextPath)) {
				let p = _.cloneDeep(pointer.get(tree, currentPath+'/*'));
				trace('about to set ', nextPath, 'to', p)
				pointer.set(tree, nextPath, p)
				//				pointer.remove(tree, currentPath+'/*')
			}
		}
		return recursiveStuff(fullPathArray, i+1, data, user, writes, tree).then((result) => {
			return stuffToDo(currentPath, user, result, i<fullPathArray.length-1, tree)
		})
	}
	trace('YIELD TILER BBBBBB', currentPath)
	// Last part of the given path, PUT the data
	let merged = _.cloneDeep(pointer.get(tree, currentPath))
	trace('merged', merged)
	_.merge(merged, data)
	pointer.set(tree, currentPath, merged)
	trace('merged 2', pointer.get(tree, currentPath))
	return stuffToDo(currentPath, user, writes, i<fullPathArray.length-1, tree)
}

// Returns the current array of writes as well as the content at currentPath
// with resources replaced with links
async function stuffToDo(currentPath, user, writes, maxDepth, tree) {
  trace('currentPath', currentPath)
	// Only generate write requests for resources
	let type = currentPath+'/_type';
	if (pointer.has(tree, type)) {
		let contentType = pointer.get(tree, type);
		let path = '/'+user.bookmarks._id+currentPath;
		// If the resource already exists, write links to potentially new children
		return oadaLib.resources.lookupFromUrl(path).then((result) => {
			let idPath = currentPath+'/_id';
			// _id of the resource should be the current _id if it already exists or 
			// if a write is already pending. It could've already made in previous
			// geohash-length processing
			let resId = result.path_leftover === '' ? result.resource_id : (pointer.has(tree, idPath) ? pointer.get(tree, idPath) : 'resources/'+uuid.v4());
			trace('setting _id', resId, idPath)
			pointer.set(tree, idPath, resId)

    	let body = _.cloneDeep(pointer.get(tree, currentPath))
	    body = replaceLinks(body, body);
	    trace('body', body)
			if (result.path_leftover === '' && maxDepth) {
				// Write to resources that already exist anyways to ensure that links
				// get made properly. They should merge in without issue.
        writes.push({
					'resource_id': result.path_leftover === '' ? resId : '',
					'path_leftover': result.path_leftover === '' ? '' : resId,
					'user_id': user._id,
				  contentType,
					body
				})
				return writes
			} else {
			  writes.push({
					'resource_id': '',
					'path_leftover': '/'+resId,
					'user_id': user._id,
					contentType,
					body
				})
				return writes
			}
		})
	}
	//Not a resource, just return an object with the parent resource linked
	return writes
}

queue.drained(function queueDrained() {
  trace('THE QUEUE IS DRAINED')
  trace('*****************************************')
  trace('*****************************************')
  trace('*****************************************')
  trace('*****************************************')
  trace('*****************************************')
})
