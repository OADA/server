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

import debug from 'debug';

import * as fs from 'fs';
import * as typeis from 'type-is';
import { connect, JSONCodec, Subscription } from 'nats';
// @ts-ignore
import * as config from './config';

import scopeTypes from './scopes';

const warn = debug('permissions-handler:warn');
const info = debug('permissions-handler:info');
const trace = debug('permissions-handler:trace');
const error = debug('permissions-handler:error');

// FIXME: I really don't know what this _should_ be
interface OadaGraph {
  type: string;
  rev: string;
  resource_id: string;
  resourceExists: boolean;
  permissions: {
    type: string;
    owner: string;
  };
}

interface OadaGraphPermission {
  read: boolean;
  write: boolean;
  owner: boolean;
}

interface OadaScopePermission {
  read: boolean;
  write: boolean;
}

interface PermissionsRequest {
  connection_id: string;
  domain: string;
  oadaGraph: OadaGraph;
  user_id: string;
  scope: Array<string>;
  contentType: string;
  requestType: 'put' | 'delete' | 'get';
}

interface PermissionsReponse {
  permissions: OadaGraphPermission;
  scopes: OadaScopePermission;
}

async function server() {
  // Augment scopeTypes by merging in anything in /scopes/additional-scopes
  try {
    const additionalScopes = fs
      .readdirSync('/code/scopes/additional-scopes')
      .filter(
        (f: String) => !f.match(/^\./) // remove hidden files
      );

    for (const file in additionalScopes) {
      try {
        trace(`Trying to add additional scope ${file}`);
        const newscope = await import(`/code/scopes/additional-scopes/${file}`);
        Object.assign(scopeTypes, newscope);
      } catch (e) {
        warn(
          `FAILED to import /code/scopes/additional-scopes/${file}: error was ${e}`
        );
      }
    }
  } catch (e) {
    warn(`No /node/scopes/additional-scopes directory, ${e}`);
  }

  const nc = await connect({ servers: ['demo.nats.io'] });
  const jc = JSONCodec();
  //@ts-ignore
  const sub = nc.subscribe(config.get('kafka:topics:permissionsRequest'));
  handleRequest(sub);

  await nc.closed().then((err) => {
    info(`connection to ${nc.getServer()} closed`);
    if (err) {
      error(`Closed with error: ${err.message}`);
    }
  });

  async function handleRequest(sub: Subscription) {
    for await (const m of sub) {
      if (!m.reply) {
        info('Recieved request with no reply topic');
        continue;
      }

      // FIXME: Bring in the @oada/types AJV stuff here to check messages in real
      // time (at least in a dev mode) to find mistakes/bugs.
      const req = jc.decode(m.data) as PermissionsRequest;

      let response: PermissionsReponse = {
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
      trace('inside permissions handler', req.oadaGraph.resource_id);
      trace('request is:', req);

      //Check scopes
      if (process.env.IGNORE_SCOPE === 'yes') {
        trace('IGNORE_SCOPE environment variable is true');
        response.scopes = { read: true, write: true };
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
          trace('User scope:', type);
          let contentType = req.oadaGraph.permissions?.type;
          //let contentType = req.requestType === 'put' ? req.contentType : (resource ? resource._type : undefined);
          //trace('contentType = ', 'is put:', req.requestType === 'put', 'req.contentType:', req.contentType, 'resource:', resource);
          trace(
            'Does user have scope?',
            'resulting contentType:',
            contentType,
            'typeis check:',
            typeis.is(contentType, scopeTypes[type])
          );
          trace('Does user have read scope?', scopePerm(perm, 'read'));
          trace('TYPEIS aaa', typeis.is(contentType, scopeTypes[type]));
          return (
            typeis.is(contentType, scopeTypes[type]) && scopePerm(perm, 'read')
          );
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
          trace('contentType is', req.contentType);
          let contentType = req.contentType || req.oadaGraph.permissions?.type;

          trace('Does user have write scope?', scopePerm(perm, 'write'));
          trace('contentType is2', contentType);
          trace('write typeis', type, typeis.is(contentType, scopeTypes[type]));
          trace('scope types', scopeTypes[type]);
          return (
            typeis.is(contentType, scopeTypes[type]) && scopePerm(perm, 'write')
          );
        });
      }
      //Check permissions. 1. Check if owner.
      // First check if we're putting to resources
      trace('resource exists', req.oadaGraph.resourceExists);
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
        // FIXME: This makes no sense ... these types are incompatable?
        // @ts-ignore
        response.permissions = req.oadaGraph.permissions;
      }

      m.respond(jc.encode(response));
      trace('Sent response', response);
    }
  }
}

function scopePerm(perm: string, has: string): boolean {
  return perm === has || perm === 'all';
}

server().catch((err) => console.error(`Unexpected error: ${err}`));
