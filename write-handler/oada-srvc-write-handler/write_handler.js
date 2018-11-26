'use strict';

const { performance } = require('perf_hooks');
const OADAError = require('oada-error').OADAError;
const Promise = require('bluebird');
const {resources, putBodies, changes} = require('../../libs/oada-lib-arangodb');
const {Responder} = require('../../libs/oada-lib-kafka');
const pointer = require('json-pointer');
const nhash = require('node-object-hash')();
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
		global.gc();
	}
	var pTime = performance.now();
	p = p.catch(() => {}).then(() => handleReq(...args)).tap(()=>{
	info('handleReq', performance.now() - pTime); 
	info('~~~~~~~~~~~~~~~~~~~~~~~~')
	info('~~~~~~~~~~~~~~~~~~~~~~~~')
});
	return p;
});


function handleReq(req, msg) {

	req.source = req.source || '';
	var id = req['resource_id'];

	// Get body and check permission in parallel
	var getB = performance.now();
	var body = Promise.try(function getBody() {
		var pb = performance.now();
		return req.body || req.bodyid && putBodies.getPutBody(req.bodyid).tap(() => {
			console.log('getPutBody', performance.now() - pb);
		});
	});
	let existingResourceInfo = {};
	info('getBody', performance.now() - getB)

	info(`PUTing to "${req['path_leftover']}" in "${id}"`);

	var changeType;
	var beforeUpsert = performance.now();
	var upsert = body.then(async function doUpsert(body) {
		info('doUpsert', performance.now() - beforeUpsert);
		if (req['if-match']) {
			var getRev = performance.now()
			var rev = await resources.getResource(req.resource_id, '_rev')
			info('getRev', performance.now() - getRev);
			if (req['if-match'] !== rev) {
				throw new Error('if-match failed');
			}
		}
		var beforeCacheRev = performance.now();
		if (req.rev) {
			let cacheRev = cache.get(req.resource_id)
			if (!cacheRev) {
				cacheRev = await resources.getResource(req.resource_id, '_rev')
			}
			if (cacheRev !== req.rev) {
				throw new Error(`rev mismatch`)
			}
		}
		info('cacheRev', performance.now() - beforeCacheRev);


		var beforeDeletePartial = performance.now()
		var path = pointer.parse(req['path_leftover'].replace(/\/*$/, ''));
		let method = resources.putResource;
		changeType = 'merge';
		// Perform delete
		if (body === undefined) {
			if (path.length > 0) {
				// TODO: This is gross
				let ppath = Array.from(path);
				method = (id, obj) =>
					resources.deletePartialResource(id, ppath, obj);
					body = null;
					changeType = 'delete';
			} else {
				return resources.deleteResource(id).tap(() => info('deleteResource', performance.now() - beforeDeletePartial));
			}
		}


		var obj = {};
		var ts = performance.now();
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

		info('recursive merge', performance.now() -ts)

		var beforeHash = performance.now();
		// Precompute new rev ignoring _meta and such
		//let newRevHash = hash(JSON.stringify(obj), {algorithm: 'md5'});
		let newRevHash = nhash.hash(obj);

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
			return rev;
		}

		obj['_rev'] = rev;
		pointer.set(obj, '/_meta/_rev', rev);
		info('hash', performance.now() - beforeHash);

		// Compute new change
		var beforeChange = performance.now();
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
		info('change_id', performance.now() - beforeChange);
		var beforeMethod = performance.now();
		pointer.set(obj, '/_meta/_changes', {
			_id: id+'/_meta/_changes',
			_rev: rev
		});
		//		let change_id = '132';

		// Update rev of meta?
		obj['_meta']['_rev'] = rev;
		
		//return {rev, orev: 'c', change_id};

		return method(id, obj).then(orev => ({rev, orev, change_id})).tap(() => info('method', performance.now() - beforeMethod));
	}).then(function respond({rev, orev, change_id}) {
    info('upsert then', performance.now() - beforeUpsert)
		var beforeCachePut = performance.now()
	  // Put the new rev into the cache
		cache.put(id, rev);
    info('cache.put', performance.now() - beforeCachePut)

		return {
			'msgtype': 'write-response',
			'code': 'success',
			'resource_id': id,
			'_rev': rev || "0-0",
			'_orev': orev,
			'user_id': req['user_id'],
			'authorizationid': req['authorizationid'],
			'path_leftover': req['path_leftover'],
			'contentType': req['contentType'],
			'indexer': req['indexer'],
			'change_id': change_id,
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

	var beforeCleanUp = performance.now()
	var cleanup = body.then(() => {
		info('cleanup', performance.now() - beforeCleanUp)
	var beforeRPB = performance.now()
		// Remove putBody, if there was one
		//		const result = req.bodyid && putBodies.removePutBody(req.bodyid);
		return req.bodyid && putBodies.removePutBody(req.bodyid).tap(() => info('remove Put Body', performance.now() - beforeRPB));
	});
	var beforeJoin = performance.now();
	return Promise.join(upsert, cleanup, resp => resp).tap(() => info('join', performance.now() - beforeJoin))
}
