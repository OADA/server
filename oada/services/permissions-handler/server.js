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

const fs = require('fs');
const { join } = require('path');

const debug = require('debug');
const typeis = require('type-is');

const { Responder } = require('@oada/lib-kafka');

const warn = debug('permissions-handler:warn');
const trace = debug('permissions-handler:trace');
const error = debug('permissions-handler:error');

const config = require('./config');
const scopeTypes = require('./scopes/builtin');

// Listen on Kafka if we are running this file
if (require.main === module) {
  //---------------------------------------------------------
  // Kafka intializations:
  const responder = new Responder(
    config.get('kafka:topics:permissionsRequest'),
    config.get('kafka:topics:httpResponse'),
    'permissions-handler'
  );

  responder.on('request', handleReq);
}

trace('Parsed builtin scopes, they are: %O', scopeTypes);
// Augment scopeTypes by merging in anything in /scopes/additional-scopes
const additionalScopesFiles = fs
  .readdirSync(join(__dirname, './scopes/additional-scopes'))
  .filter(
    (f) => !f.match(/^\./) // remove hidden files
  );
additionalScopesFiles.forEach((af) => {
  try {
    trace('Trying to add additional scope ' + af);
    const newscope = require('./scopes/additional-scopes/' + af);
    Object.keys(newscope).forEach((k) => {
      trace('Setting scopeTypes[%s] to new scope %s', k, newscope[k]);
      scopeTypes[k] = newscope[k]; // overwrite entire scope, or create new if doesn't exist
    });
  } catch (e) {
    warn('FAILED to require(scopes/additional-scopes/%s: error was %O', af, e);
  }
});

function scopePerm(perm, has) {
  return perm === has || perm === 'all';
}

function handleReq(req) {
  let response = {
    scopes: {
      read: false,
      write: false,
    },
    permissions: {
      read: false,
      write: false,
      owner: false,
    },
  };
  trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  trace('~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~');
  trace('inside permissions handler %s', req.oadaGraph.resource_id);
  //    return oadaLib.resources.getResource(req.oadaGraph.resource_id, '').then((resource) => {
  trace('request is: %O', req);
  //        trace('Resource is', req.oadaGraph.resource_id, resource);
  //Check scopes
  if (process.env.IGNORE_SCOPE === 'yes') {
    trace('IGNORE_SCOPE environment variable is true');
    response.scopes = { read: true, write: true };
  } else {
    // Check for read permission
    if (!Array.isArray(req.scope)) {
      error('ERROR: scope is not an array: %O', req.scope);
      req.scope = [];
    }
    response.scopes.read = req.scope.some(function chkScope(scope) {
      const [type, perm] = scope.split(':');

      if (!scopeTypes[type]) {
        warn('Unsupported scope type "%s"', type);
        return false;
      }
      trace('User scope: %s', type);
      let contentType = req.oadaGraph.permissions
        ? req.oadaGraph.permissions.type
        : undefined;
      //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
      //trace('contentType = ', 'is put:', req.requestType === 'put', 'req.contentType:', req.contentType, 'resource:', resource);
      trace(
        'Does user have scope? resulting contentType: %s typeis check: %s',
        contentType,
        typeis.is(contentType, scopeTypes[type])
      );
      trace('Does user have read scope? %s', scopePerm(perm, 'read'));
      trace('TYPEIS aaa %s', typeis.is(contentType, scopeTypes[type]));
      return (
        typeis.is(contentType, scopeTypes[type]) && scopePerm(perm, 'read')
      );
    });

    // Check for write permission
    response.scopes.write = req.scope.some(function chkScope(scope) {
      const [type, perm] = scope.split(':');

      if (!scopeTypes[type]) {
        warn('Unsupported scope type "%s"', type);
        return false;
      }
      //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
      trace('contentType is %s', req.contentType);
      let contentType = req.oadaGraph.permissions
        ? req.oadaGraph.permissions.type
        : undefined;
      if (req.contentType) contentType = req.contentType;
      trace('Does user have write scope? %s', scopePerm(perm, 'write'));
      trace('contentType is2 %s', contentType);
      trace(
        'write typeis %s %s',
        type,
        typeis.is(contentType, scopeTypes[type])
      );
      trace('scope types %O', scopeTypes[type]);
      return (
        typeis.is(contentType, scopeTypes[type]) && scopePerm(perm, 'write')
      );
    });
  }
  //Check permissions. 1. Check if owner.
  // First check if we're putting to resources
  trace('resource exists %s', req.oadaGraph.resourceExists);
  if (
    req.oadaGraph.permissions &&
    req.oadaGraph.permissions.owner &&
    req.oadaGraph.permissions.owner === req.user_id
  ) {
    //if (resource && resource._meta && resource._meta._owner === req.user_id) {
    trace('Resource requested by owner.');
    response.permissions = {
      read: true,
      write: true,
      owner: true,
    };
    //Check permissions. 2. Check if resouce does not exist
  } else if (!req.oadaGraph.resourceExists) {
    response.permissions = {
      read: true,
      write: true,
      owner: true,
    };
  } else {
    response.permissions = req.oadaGraph.permissions;
  }
  trace('END RESULT %O', response);
  return response;
  //});
}

module.exports = { handleReq };
