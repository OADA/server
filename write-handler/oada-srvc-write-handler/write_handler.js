'use strict';

const Promise = require('bluebird');
const {resources, putBodies, changes} = require('../../libs/oada-lib-arangodb');
const {Responder} = require('../../libs/oada-lib-kafka');
const pointer = require('json-pointer');
const nhash = require('node-object-hash');
const hash = require('object-hash');
const error = require('debug')('write-handler:error');
const info = require('debug')('write-handler:info');
const trace = require('debug')('write-handler:trace');
const Cache = require('timed-cache');
let counter = 0;

var config = require('./config');

var responder = new Responder({
    consumeTopic: config.get('kafka:topics:writeRequest'),
    produceTopic: config.get('kafka:topics:httpResponse'),
    group: 'write-handlers'
});

// Only run one write at a time?
// TODO: Maybe block separately for each resource
let p = Promise.resolve();
let cache = new Cache({defaultTtl: 60 * 1000});
responder.on('request', (...args) => {
	// Run once last write finishes (whether it worked or not)
	if (counter++ > 500) {
		counter = 0;
		console.log('RUNNING GARBAGE COLLECTOR')
		let aa = new Date();
		global.gc();
		let ba = new Date();
		console.log('DONE RUNNING GC', ba-aa)
	}
	p = p.catch(() => {}).then(() => handleReq(...args));
	return p;
});

function handleReq(req, msg) {
	var start = new Date();
	req.source = req.source || '';
	var id = req['resource_id'];

	// Get body and check permission in parallel
	var body = Promise.try(function getBody() {
		return req.body || req.bodyid && putBodies.getPutBody(req.bodyid);
	});
	let existingResourceInfo = {};

	info(`PUTing to "${req['path_leftover']}" in "${id}"`);

	var upsert = body.then(async function doUpsert(body) {
		if (req.rev) {
				let cacheRev = cache.get(req.resource_id)
			if (!cacheRev) {
					cacheRev = await resources.getResource(req.resource_id, '_rev')
			}
			if (cacheRev !== req.rev) {
				//trace(cacheRev, req.rev)
						throw new Error(`rev mismatch`)
			}
		}

		var path = pointer.parse(req['path_leftover'].replace(/\/*$/, ''));
		let method = resources.putResource;
		let changeType = 'merge';
		// Perform delete
		// TODO: Should deletes be a separate topic?
		if (body === undefined) {
				// TODO: How to handle rev etc. on DELETE?
				if (path.length > 0) {
						// TODO: This is gross
						let ppath = Array.from(path);
						method = (id, obj) =>
								resources.deletePartialResource(id, ppath, obj);
						body = null;
						changeType = 'delete';
				} else {
						return resources.deleteResource(id);
				}
		}

		var obj = {};
		var ts = Date.now();
		// TODO: Sanitize keys?

		// Create new resource
		if (!id) {
				id = 'resources/' + path[1];
				path = path.slice(2);

				// Initialize resource stuff
				obj = {
						'_type': req['contentType'],
						'_meta': {
								'_id': id + '/_meta',
								'_type': req['contentType'],
								'_owner': req['user_id'],
								'stats': {
										'createdBy': req['user_id'],
										'created': ts
								},
						}
				};
		}

		// Create object to recursively merge into the resource
		if (path.length > 0) {
				let o = obj;

				let endk = path.pop();
				path.forEach(k => {
						if (!(k in o)) {
								// TODO: Support arrays better?
								o[k] = {};
						}
						o = o[k];
				});

				o[endk] = body;
		} else {
				obj = Object.assign(obj, body);
		}

		// Precompute new rev ignoring _meta and such
		//let newRevHash = hash(JSON.stringify(obj), {algorithm: 'md5'});
		let newRevHash = nhash(obj);

		// Update meta
		var meta = {
				'modifiedBy': req['user_id'],
				'modified': ts
		};
		obj['_meta'] = Object.assign(obj['_meta'] || {}, meta);

		var rev = msg.offset + '-' + newRevHash;

		// If the hash part of the rev is identical to last time,
		// don't re-execute a PUT to keep it idempotent
		existingResourceInfo['_rev'] = existingResourceInfo['_rev'] || '0-0';
		const oldRevHash = existingResourceInfo['_rev'].split('-')[1];
		if (oldRevHash === newRevHash) {
			//            info('PUT would result in same rev hash as the current one,' +
			//                    ' skipping write.');
				return rev;
		} else {
			//            trace(`PUT is a new hash (${newRevHash}, old = ${oldRevHash}),` +
			//                    ' performing write');
		}

		obj['_rev'] = rev;
		pointer.set(obj, '/_meta/_rev', rev);

		// Compute new change
		//
		let change_id = await changes.putChange({
				change: obj,
				resId: id,
				rev,
				type: changeType,
				child: req['from_change_id'],
				path: req['change_path'],
				userId: req['user_id'],
				authorizationId: req['authorizationid'],
		})

		pointer.set(obj, '/_meta/_changes', {
			_id: id+'/_meta/_changes',
			_rev: rev
		});

		// Update rev of meta?
		obj['_meta']['_rev'] = rev;
		
		//return {rev, orev: 'c', change_id};
		return method(id, obj).then(orev => ({rev, orev, change_id}));
	}).then(function respond({rev, orev, change_id}) {
			let end = new Date();
			info(`Finished PUTing to "${req['path_leftover']}". +${end - start}ms`);

			// Put the new rev into the cache
			cache.put(id, rev);

			return {
					'msgtype': 'write-response',
					'code': 'success',
					'resource_id': id,
					'_rev': rev,
					'_orev': orev,
					'user_id': req['user_id'],
					'authorizationid': req['authorizationid'],
					'path_leftover': req['path_leftover'],
					'contentType': req['contentType'],
					'indexer': req['indexer'],
					'change_id': change_id
			};
	}).catch(resources.NotFoundError, function respondNotFound(err) {
			error(err);
			return {
					'msgtype': 'write-response',
					'code': 'not_found',
					'user_id': req['user_id'],
					'authorizationid': req['authorizationid'],
			};
	}).catch(function respondErr(err) {
			error(err);
			return {
					'msgtype': 'write-response',
					'code': err.message || 'error',
					'user_id': req['user_id'],
					'authorizationid': req['authorizationid'],
			};
	});

	var cleanup = body.then(() => {
		// Remove putBody, if there was one
		return req.bodyid && putBodies.removePutBody(req.bodyid);
		return;
	});

	return Promise.join(upsert, cleanup, resp => resp);
}
