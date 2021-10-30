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

import fs from 'fs';
import { URL } from 'url';

import { Responder } from '@oada/lib-kafka';

import config from './config.js';
import scopeTypes from './scopes.js';

import esMain from 'es-main';
import debug from 'debug';
import typeis from 'type-is';

const warn = debug('permissions-handler:warn');
const trace = debug('permissions-handler:trace');
const error = debug('permissions-handler:error');

export type Perm = 'read' | 'write' | 'all';
export type Scope = `${string}:${Perm}`;
export type Scopes = typeof scopeTypes;

// Listen on Kafka if we are running this file
if (esMain(import.meta)) {
  //---------------------------------------------------------
  // Kafka initializations:
  const responder = new Responder({
    consumeTopic: config.get('kafka.topics.permissionsRequest'),
    produceTopic: config.get('kafka.topics.httpResponse'),
    group: 'permissions-handler',
  });

  responder.on('request', handleReq);
}

trace(scopeTypes, 'Parsed builtin scopes');
// Augment scopeTypes by merging in anything in /scopes/additional-scopes
const additionalScopesFiles = fs
  .readdirSync(new URL('../scopes/additional-scopes', import.meta.url))
  .filter(
    (f) => !/^\./.exec(f) // remove hidden files
  );
additionalScopesFiles.forEach((af) => {
  try {
    trace('Trying to add additional scope %s', af);
    const newscope = require('../scopes/additional-scopes/' + af) as Scopes; // nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
    Object.entries(newscope).forEach(([k, scope]) => {
      trace('Setting scopeTypes[%s] to new scope %s', k, scope);
      scopeTypes[k] = scope; // overwrite entire scope, or create new if doesn't exist
    });
  } catch (e) {
    error(e, `Failed to require(scopes/additional-scopes/${af}})`);
  }
});

function scopePerm(perm: Perm, has: Perm): boolean {
  return perm === has || perm === 'all';
}

export interface PermissionsRequest {
  scope: readonly Scope[];
  contentType?: string;
  user_id: string;
  oadaGraph: {
    resource_id: string;
    resourceExists: boolean;
    permissions?: {
      type?: string;
      owner?: string;
      read?: boolean;
      write?: boolean;
    };
  };
}

export interface PermissionsResponse {
  scopes: { read: boolean; write: boolean };
  permissions: { read?: boolean; write?: boolean; owner?: boolean };
}

export function handleReq(req: PermissionsRequest): PermissionsResponse {
  const response: PermissionsResponse = {
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
  trace('inside permissions handler %s', req.oadaGraph.resource_id);
  //    return oadaLib.resources.getResource(req.oadaGraph.resource_id, '').then((resource) => {
  trace(req, 'request');
  //        trace('Resource is', req.oadaGraph.resource_id, resource);
  //Check scopes
  if (process.env.IGNORE_SCOPE === 'yes') {
    trace('IGNORE_SCOPE environment variable is true');
    response.scopes = { read: true, write: true };
  } else {
    // Check for read permission
    if (!Array.isArray(req.scope)) {
      error(req.scope, 'Scope is not an array');
      req.scope = [];
    }
    response.scopes.read = req.scope.some(function chkScope(scope) {
      const [type, perm] = scope.split(':') as [string, Perm];

      if (!scopeTypes[type]) {
        warn('Unsupported scope type "%s"', type);
        return false;
      }
      trace('User scope: %s', type);
      const contentType = req.oadaGraph.permissions?.type || undefined;
      const is = contentType
        ? typeis.is(contentType, scopeTypes[type] ?? [])
        : false;
      //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
      //trace('contentType = ', 'is put:', req.requestType === 'put', 'req.contentType:', req.contentType, 'resource:', resource);
      trace(
        'Does user have scope? resulting contentType: %s typeis check: %s',
        contentType,
        is
      );
      trace('Does user have read scope? %s', scopePerm(perm, 'read'));
      return is && scopePerm(perm, 'read');
    });

    // Check for write permission
    response.scopes.write = req.scope.some(function chkScope(scope) {
      const [type, perm] = scope.split(':') as [string, Perm];

      if (!scopeTypes[type]) {
        warn('Unsupported scope type "%s"', type);
        return false;
      }
      //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
      trace('contentType is %s', req.contentType);
      const contentType =
        req.contentType || req.oadaGraph.permissions?.type || undefined;
      const is = contentType
        ? typeis.is(contentType, scopeTypes[type] ?? [])
        : false;
      const write = scopePerm(perm, 'write');
      trace('Does user have write scope? %s', write);
      trace('contentType is %s', contentType);
      trace('write typeis %s %s', type, is);
      trace('scope types %O', scopeTypes[type]);
      return is && write;
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
    //Check permissions. 2. Check if resource does not exist
  } else if (!req.oadaGraph.resourceExists) {
    response.permissions = {
      read: true,
      write: true,
      owner: true,
    };
  } else {
    response.permissions = {
      ...req.oadaGraph.permissions,
      owner: !!req.oadaGraph.permissions?.owner,
    };
  }
  trace(response, 'END RESULT');
  return response;
  //});
}
