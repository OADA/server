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
        'application/vnd.fpad.audit.primusgfs.1+json',
        'application/vnd.fpad.audit.globalgap.1+json',
        'application/vnd.fpad.certification.primusgfs.1+json',
        'application/vnd.fpad.certification.globalgap.1+json',
        'application/vnd.fpad.certifications.globalgap.1+json',
        'application/vnd.fpad.client.1+json',
        'application/vnd.fpad.clients.1+json',
        'application/vnd.fpad.1+json',
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
    };
    return oadaLib.resources.getResource(req.oadaGraph.resource_id, '').then((resource) => {
        //Check scopes
        if (process.env.IGNORE_SCOPE === 'yes') {
            trace('IGNORE_SCOPE environment variable is true');
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

								trace('resource exist? ', resource, req.contentType)
                let contentType = resource ? resource._type : req.contentType;
								trace(contentType, 'on the list? ', scopeTypes[type].indexOf(contentType))
								trace('user scope all/read?', scopePerm(perm, 'read'))
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
								trace('resource exist? ', resource, req.contentType)
							let contentType = resource ? resource._type : req.contentType;
							trace(contentType, 'on the list? ', scopeTypes[type].indexOf(contentType))
							trace('user scope all/write?', scopePerm(perm, 'write'))
                return scopeTypes[type].indexOf(contentType) >= 0 &&
                        scopePerm(perm, 'write');
            });
        }
        //Check permissions. 1. Check if owner.
        if (resource && resource._meta._owner === req.user_id) {
            trace('Resource requested by owner.');
            response.permissions = {
                read: true,
                write: true,
                owner: true
            };
        //Check permissions. 2. Check if otherwise permissioned.
        } else {
            response.permissions = req.oadaGraph.permissions;
        }
        trace('END RESULT', response);
        return response;
    });
});
