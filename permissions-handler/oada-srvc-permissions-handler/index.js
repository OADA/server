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
const warn = debug('permissions-handler:trace');
const trace = debug('permissions-handler:trace');
const info = debug('permissions-handler:info');
const error = debug('permissions-handler:error');

const Promise = require('bluebird');
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
			config.get('kafka:topics:permissionsRequest'),
			config.get('kafka:topics:httpResponse'),
			'permissions-handler');

module.exports = function stopResp() {
  return responder.disconnect(); 
};

const scopeTypes = {                                                         
  'oada.rocks': [                                                          
		'application/vnd.oada.bookmarks.1+json',                             
		'application/vnd.oada.shares.1+json',                                
		'application/vnd.oada.rocks.1+json',                                 
		'application/vnd.oada.rock.1+json',                                  
		'application/vnd.fpad.audit.globalgap.1+json',
	],
	'fpad': [
		'application/vnd.oada.bookmarks.1+json',                             
		'application/vnd.oada.shares.1+json',                                
		'application/vnd.oada.rocks.1+json',                                 
		'application/vnd.oada.rock.1+json',                                  
		'application/vnd.fpad.audit.globalgap.1+json',
	]
};                                                                           
function scopePerm(perm, has) {                                              
  return perm === has || perm === 'all';                                   
}                                                                            
                                                                                 
responder.on('request', function handleReq(req) {
	let response = {
		scopes: {
			read: false,
			write: false,
		},
		permissions: {
			read: false,
			write: false,
			owner: false
		}
	}
	let user_id = req.user_id.split('/')[1]
	return oadaLib.resources.getResource(req.oadaGraph.resource_id, '').then((resource) => {
		//Check scopes
		if (process.env.IGNORE_SCOPE === 'yes') {
	    trace('IGNORE_SCOPE environment variable is true')
			responder.scopes = { read: true, write: true };
		} else {
			//TODO: fix duplicated code here.......
			response.scopes.read = req.scope.some(function chkScope(scope) {
	      var type;
				var perm;
				[type, perm] = scope.split(':');

				if (!scopeTypes[type]) {
					warn('Unsupported scope type "' + type + '"');
					return false;
				}

        let contentType = resource ? resource._type : req.content_type
				return scopeTypes[type].indexOf(contentType) >= 0 && 
					scopePerm(perm, 'read');
			});

			response.scopes.write = req.scope.some(function chkScope(scope) {
	      var type;
				var perm;
				[type, perm] = scope.split(':');

				if (!scopeTypes[type]) {
					warn('Unsupported scope type "' + type + '"');
					return false;
				}
				trace('A', resource ? true : false)
				trace('B', resource ? resource._type : req.content_type)
				let contentType = resource ? resource._type : req.content_type
				trace('C', scopeTypes[type].indexOf(contentType) >= 0)
				trace('D', scopePerm(perm, 'write'))
				return scopeTypes[type].indexOf(contentType) >= 0 &&
					scopePerm(perm, 'write');
			});
		}
   	trace('2HERE')
		trace(resource && resource._meta._owner === req.user_id)
		trace(resource && resource._meta._permissions && 
			Object.keys(resource._meta._permissions.users)
			.some(user => user === user_id))
		trace(req.content_type)
		//Check permissions. 1. Check if owner.
		if (resource && resource._meta._owner === req.user_id) {
	    trace('Resource requested by owner.')
			response.permissions = {
				read: true,
				write: true,
				owner: true
			}
		//Check permissions. 2. Check if otherwise permissioned.
		} else if (resource && resource._meta._permissions && 
			Object.keys(resource._meta._permissions.users)
			.some(user => user === user_id)) {
	      trace('User has permissions on requested resource.')
			response.permissions = resource._meta._permissions.users[user_id]
		} else if (req.content_type) {
			trace('1HERE')
			response.permissions = {
				read: true,
				write: true,
				owner: true
			}
		}
		trace('END RESULT', response)
		return response
	})
})
