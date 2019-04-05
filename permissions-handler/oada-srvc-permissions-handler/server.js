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
const typeis = require('type-is');
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
  'oada.mirrors': [
    'application/vnd.oada.mirrors.1:json',
  ],
  'oada.fields': [
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.shares.1+json',
		'application/vnd.oada.fields.1+json',
		'application/vnd.oada.field.1+json',
		'application/json',
  ],
  'oada.isoblue': [
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.isoblue.1+json',
		'application/vnd.oada.isoblue.device.1+json',
		'application/vnd.oada.isoblue.dataset.1+json',
		'application/vnd.oada.isoblue.day.1+json',
		'application/vnd.oada.isoblue.hour.1+json',
		'application/json',
  ],
  'oada.operations': [
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.shares.1+json',
		'application/vnd.oada.operation.1+json',
		'application/vnd.oada.operations.1+json',
		'application/json',
  ],
  'oada.rocks': [
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.shares.1+json',
		'application/vnd.oada.rocks.1+json',
		'application/vnd.oada.rock.1+json',
		'application/json',
  ],
  'trellisfw': [
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.shares.1+json',
		'application/vnd.oada.rocks.1+json',
		'application/vnd.oada.rock.1+json',
		'application/vnd.trellisfw.audit.primusgfs.1+json',
		'application/vnd.trellisfw.audit.globalgap.1+json',
		'application/vnd.trellisfw.certification.primusgfs.1+json',
		'application/vnd.trellisfw.certification.globalgap.1+json',
		'application/vnd.trellisfw.certifications.globalgap.1+json',
		'application/vnd.trellisfw.certifications.1+json',
		'application/vnd.trellisfw.client.1+json',
		'application/vnd.trellisfw.clients.1+json',
		'application/vnd.trellisfw.connection.1+json',
		'application/vnd.trellisfw.1+json',
		'application/json',
	],
  'trellis': [
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.shares.1+json',
		'application/vnd.oada.rocks.1+json',
		'application/vnd.oada.rock.1+json',
		'application/vnd.trellis.audit.primusgfs.1+json',
		'application/vnd.trellis.audit.globalgap.1+json',
		'application/vnd.trellis.certification.primusgfs.1+json',
		'application/vnd.trellis.certification.globalgap.1+json',
		'application/vnd.trellis.certifications.globalgap.1+json',
		'application/vnd.trellis.certifications.1+json',
		'application/vnd.trellis.client.1+json',
		'application/vnd.trellis.clients.1+json',
		'application/vnd.trellis.connection.1+json',
		'application/vnd.trellis.1+json',
		'application/json',
	],
  'oada.yield': [
    'application/vnd.oada.services.1+json',
    'application/vnd.oada.service.1+json',
		'application/vnd.oada.bookmarks.1+json',
		'application/vnd.oada.shares.1+json',
		'application/vnd.oada.tiled-maps.1+json',
		'application/vnd.oada.tiled-maps.dry-yield-map.1+json',
		'application/vnd.oada.harvest.1+json',
		'application/vnd.oada.as-harvested.1+json',
		'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
		'application/vnd.oada.data-index.1+json',
		'application/vnd.oada.data-index.tiled-maps.1+json',
		'application/vnd.oada.connection.1+json',
		'application/vnd.oada.note.1+json',
		'application/vnd.oada.notes.1+json',
		'application/vnd.oada.field.1+json',
		'application/vnd.oada.fields.1+json',
		'application/vnd.oada.grower.1+json',
		'application/vnd.oada.farm.1+json',
		'application/vnd.oada.yield.1+json',
		'application/vnd.oada.as-harvested.geohash.1+json',
		'application/json',
	],
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
					  // Check for read permission
            response.scopes.read = req.scope.some(function chkScope(scope) {
                var type;
                var perm;
                [type, perm] = scope.split(':');

                if (!scopeTypes[type]) {
                    warn('Unsupported scope type "' + type + '"');
                    return false;
                }
                trace('User scope:', type)
                let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
                trace('Does user have scope?', contentType, typeis.is(contentType, scopeTypes[type]))
                trace('Does user have read scope?', scopePerm(perm, 'read'))
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
                let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
              trace('Does user have write scope?', scopePerm(perm, 'write'))
                return typeis.is(contentType, scopeTypes[type]) &&
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
