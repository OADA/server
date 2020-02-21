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
const fs = require('fs');
const typeis = require('type-is');
const warn = debug('permissions-handler:warn');
const info = debug('permissions-handler:info');
const trace = debug('permissions-handler:trace');

const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');
const config = require('./config');
const _ = require('lodash');

//---------------------------------------------------------
// Kafka intializations:
const responder = new Responder(
            config.get('kafka:topics:permissionsRequest'),
            config.get('kafka:topics:httpResponse'),
            'permissions-handler');

module.exports = function stopResp() {
  return responder.disconnect();
};

const scopeTypes = require('/code/scopes/builtin');
trace('Parsed builtin scopes, they are: ', scopeTypes);
// Augment scopeTypes by merging in anything in /scopes/additional-scopes
const additionalScopesFiles = _.filter(
  fs.readdirSync('/code/scopes/additional-scopes'), 
  f => !f.match(/^\./) // remove hidden files
);
_.each(additionalScopesFiles, af => {
  try { 
    trace('Trying to add additional scope '+af);
    const newscope = require('/code/scopes/additional-scopes/'+af);
    _.each(_.keys(newscope), k => {
      trace('Setting scopeTypes['+k+'] to new scope ',newscope[k]);
      scopeTypes[k] = newscope[k]; // overwrite entire scope, or create new if doesn't exist
    });
  } catch(e) {
    warn('FAILED to require(/code/scopes/additional-scopes/'+af+': error was ',e);
  }
});

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
    };
    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~') 
    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~') 
    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~') 
    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~') 
    trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~') 
    trace('inside permissions handler', req.oadaGraph.resource_id);
//    return oadaLib.resources.getResource(req.oadaGraph.resource_id, '').then((resource) => {
        trace('request is:', req);
//        trace('Resource is', req.oadaGraph.resource_id, resource);
        //Check scopes
        if (process.env.IGNORE_SCOPE === 'yes') {
            trace('IGNORE_SCOPE environment variable is true');
            responder.scopes = { read: true, write: true };
				} else {
					  // Check for read permission
            response.scopes.read = req.scope.some(function chkScope(scope) {
                var type;
                var perm;
                [type, perm] = scope.split(':');

                if (!scopeTypes[type]) {
                    warn('Unsupported scope type "' + type + '"');
                    return false;
                }
                console.log('TEST TYPIS', typeis.is('application/json', ['application/json']));
                trace('User scope:', type)
                let contentType = req.oadaGraph.permissions ? req.oadaGraph.permissions.type : undefined;
                //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
                //trace('contentType = ', 'is put:', req.requestType === 'put', 'req.contentType:', req.contentType, 'resource:', resource);
                trace('Does user have scope?', 'resulting contentType:', contentType, 'typeis check:', typeis.is(contentType, scopeTypes[type]))
                trace('Does user have read scope?', scopePerm(perm, 'read'))
                trace('TYPEIS aaa', typeis.is(contentType, scopeTypes[type]))
                return typeis.is(contentType, scopeTypes[type]) &&
                        scopePerm(perm, 'read');
            });

	// Check for write permission
            response.scopes.write = req.scope.some(function chkScope(scope) {
                var type;
                var perm;
                [type, perm] = scope.split(':');

                if (!scopeTypes[type]) {
                    warn('Unsupported scope type "' + type + '"');
                    return false;
                }
                //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
                console.log('contentType is', req.contentType)
                let contentType = req.oadaGraph.permissions ? req.oadaGraph.permissions.type : undefined;
                if (req.contentType) contentType = req.contentType;
                trace('Does user have write scope?', scopePerm(perm, 'write'))
                console.log('contentType is2', contentType)
                console.log('write typeis', type, typeis.is(contentType, scopeTypes[type]));
                console.log('scope types', scopeTypes[type]);
                return typeis.is(contentType, scopeTypes[type]) &&
                        scopePerm(perm, 'write');
            });
        }
        //Check permissions. 1. Check if owner.
        // First check if we're putting to resources 
        console.log('resource exists', req.oadaGraph.resourceExists);
        if (req.oadaGraph.permissions && req.oadaGraph.permissions.owner && req.oadaGraph.permissions.owner === req.user_id) {
        //if (resource && resource._meta && resource._meta._owner === req.user_id) {
            trace('Resource requested by owner.');
            response.permissions = {
                read: true,
                write: true,
                owner: true
            };
        //Check permissions. 2. Check if resouce does not exist
        } else if (!req.oadaGraph.resourceExists) {
          response.permissions = {
            read: true,
            write: true,
            owner: true
          }
				} else {
            response.permissions = req.oadaGraph.permissions;
        }
        trace('END RESULT', response);
        return response;
    //});
});
