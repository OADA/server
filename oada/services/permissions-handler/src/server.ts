/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { URL } from 'node:url';
import fs from 'node:fs';

import { Responder } from '@oada/lib-kafka';

import { config } from './config.js';
import scopeTypes from './scopes.js';

import debug from 'debug';
import esMain from 'es-main';
import typeIs from 'type-is';

const warn = debug('permissions-handler:warn');
const trace = debug('permissions-handler:trace');
const error = debug('permissions-handler:error');

const scopes = new Map(Object.entries(scopeTypes));

export type Perm = 'read' | 'write' | 'all';
export type Scope = `${string}:${Perm}`;
export type Scopes = typeof scopeTypes;

// Listen on Kafka if we are running this file
if (esMain(import.meta)) {
  // ---------------------------------------------------------
  // Kafka initializations:
  const responder = new Responder({
    consumeTopic: config.get('kafka.topics.permissionsRequest'),
    produceTopic: config.get('kafka.topics.httpResponse'),
    group: 'permissions-handler',
  });

  responder.on('request', handleRequest);
}

trace(scopeTypes, 'Parsed builtin scopes');
// Augment scopeTypes by merging in anything in /scopes/additional-scopes
const additionalScopesFiles = fs
  .readdirSync(new URL('../scopes/additional-scopes', import.meta.url))
  .filter(
    (f) => !f.startsWith('.') // Remove hidden files
  );
for await (const af of additionalScopesFiles) {
  try {
    trace('Trying to add additional scope %s', af);
    const { default: newscope } = (await import(
      `../scopes/additional-scopes/${af}`
    )) as { default: Scopes }; // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
    for (const [k, scope] of Object.entries(newscope)) {
      trace('Setting scopes key %s to new scope %s', k, scope);
      scopes.set(k, scope); // Overwrite entire scope, or create new if doesn't exist
    }
  } catch (cError: unknown) {
    error(cError, `Failed to require(scopes/additional-scopes/${af}})`);
  }
}

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

export function handleRequest(
  request: PermissionsRequest
): PermissionsResponse {
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
  trace('inside permissions handler %s', request.oadaGraph.resource_id);
  //    Return oadaLib.resources.getResource(req.oadaGraph.resource_id, '').then((resource) => {
  trace(request, 'request');
  //        Trace('Resource is', req.oadaGraph.resource_id, resource);
  // Check scopes
  if (process.env.IGNORE_SCOPE === 'yes') {
    trace('IGNORE_SCOPE environment variable is true');
    response.scopes = { read: true, write: true };
  } else {
    // Check for read permission
    if (!Array.isArray(request.scope)) {
      error(request.scope, 'Scope is not an array');
      request.scope = [];
    }

    response.scopes.read = request.scope.some((scope) => {
      const [type, perm] = scope.split(':') as [string, Perm];

      if (!scopes.has(type)) {
        warn('Unsupported scope type "%s"', type);
        return false;
      }

      trace('User scope: %s', type);
      const contentType = request.oadaGraph.permissions?.type ?? undefined;
      const is = contentType
        ? typeIs.is(contentType, scopes.get(type) ?? [])
        : false;
      // Let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
      // trace('contentType = ', 'is put:', req.requestType === 'put', 'req.contentType:', req.contentType, 'resource:', resource);
      trace(
        'Does user have scope? resulting contentType: %s typeis check: %s',
        contentType,
        is
      );
      trace('Does user have read scope? %s', scopePerm(perm, 'read'));
      return is && scopePerm(perm, 'read');
    });

    // Check for write permission
    response.scopes.write = request.scope.some((scope) => {
      const [type, perm] = scope.split(':') as [string, Perm];

      if (!scopes.has(type)) {
        warn('Unsupported scope type "%s"', type);
        return false;
      }

      // Let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
      trace('contentType is %s', request.contentType);
      const contentType =
        request.contentType ?? request.oadaGraph.permissions?.type;
      const is = contentType
        ? typeIs.is(contentType, scopes.get(type) ?? [])
        : false;
      const write = scopePerm(perm, 'write');
      trace('Does user have write scope? %s', write);
      trace('contentType is %s', contentType);
      trace('write typeis %s %s', type, is);
      trace(scopes.get(type), 'scope types');
      return is && write;
    });
  }

  // Check permissions. 1. Check if owner.
  // First check if we're putting to resources
  trace('resource exists %s', request.oadaGraph.resourceExists);
  if (
    request.oadaGraph.permissions?.owner &&
    request.oadaGraph.permissions.owner === request.user_id
  ) {
    // If (resource && resource._meta && resource._meta._owner === req.user_id) {
    trace('Resource requested by owner.');
    response.permissions = {
      read: true,
      write: true,
      owner: true,
    };
    // Check permissions. 2. Check if resource does not exist
  } else if (request.oadaGraph.resourceExists) {
    response.permissions = {
      ...request.oadaGraph.permissions,
      owner: Boolean(request.oadaGraph.permissions?.owner),
    };
  } else {
    response.permissions = {
      read: true,
      write: true,
      owner: true,
    };
  }

  trace(response, 'END RESULT');
  return response;
  // });
}
