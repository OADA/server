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

import '@oada/pino-debug';

import { config } from './config.js';

import '@oada/lib-prom';

import { URL } from 'node:url';
import fs from 'node:fs/promises';

import scopeTypes from './scopes.js';

import esMain from 'es-main';
import libDebug from 'debug';
import typeIs from 'type-is';

const warn = libDebug('permissions-handler:warn');
const debug = libDebug('permissions-handler:debug');
const trace = libDebug('permissions-handler:trace');
const error = libDebug('permissions-handler:error');

export type Perm = 'read' | 'write' | 'all';
export type Scope = `${string}:${Perm}`;
export type Scopes = Record<string, string[]>;

const scopes = new Map(Object.entries(scopeTypes as Scopes));

// Listen on Kafka if we are running this file
if (esMain(import.meta)) {
  const { Responder } = await import('@oada/lib-kafka');
  // ---------------------------------------------------------
  // Kafka initializations:
  const responder = new Responder({
    consumeTopic: config.get('kafka.topics.permissionsRequest'),
    produceTopic: config.get('kafka.topics.httpResponse'),
    group: 'permissions-handler',
  });

  responder.on('request', handleRequest);
}

// Augment scopeTypes by merging in anything in /scopes/additional-scopes
const additionalScopesFiles =
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  (await fs.readdir(new URL('../scopes/additional-scopes', import.meta.url)))
    // eslint-disable-next-line unicorn/no-await-expression-member
    .filter(
      (f) => !f.startsWith('.'), // Remove hidden files
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
    error(
      { error: cError },
      `Failed to require(scopes/additional-scopes/${af}})`,
    );
  }
}

debug({ scopes }, 'Loaded known scopes');

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
  request: PermissionsRequest,
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
  trace({ request }, 'permissions handler request received');

  function userHasPerm(wantPerm: 'read' | 'write', scope: Scope): boolean {
    const [type, perm] = scope.split(':') as [string, Perm];

    if (!scopes.has(type)) {
      error({ type, request }, 'Unknown scope type');
      return false;
    }

    const contentType = request.oadaGraph.permissions?.type ?? undefined;
    const is = contentType
      ? typeIs.is(contentType, scopes.get(type) ?? [])
      : false;
    const userPerm = scopePerm(perm, wantPerm);
    trace(
      { scope, type, perm, contentType, is, userPerm },
      `Checked user/token for ${wantPerm} scope for content-type`,
    );
    return is ? userPerm : false;
  }

  // Check scopes
  if (process.env.IGNORE_SCOPE === 'yes') {
    warn('IGNORE_SCOPE environment variable is true');
    response.scopes = { read: true, write: true };
  } else {
    if (!Array.isArray(request.scope)) {
      error({ scope: request.scope }, 'Scope is not an array');
      request.scope = [];
    }

    response.scopes = {
      // Check for read permission
      read: request.scope.some((scope) => userHasPerm('read', scope)),
      // Check for write permission
      write: request.scope.some((scope) => userHasPerm('write', scope)),
    };
  }

  const owner = Boolean(request.oadaGraph.permissions?.owner);
  response.permissions = request.oadaGraph.resourceExists
    ? {
        ...request.oadaGraph.permissions,
        owner,
      }
    : {
        read: true,
        write: true,
        owner,
      };

  trace({ response }, 'permissions response');
  return response;
}
