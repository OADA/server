/* Copyright 2021 Open Ag Data Alliance
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

import type { CreateCollectionOptions } from 'arangojs/collection';

import libConfig from '@oada/lib-config';

interface Collection {
  name: string;
  createOptions?: CreateCollectionOptions;
  indexes: (
    | string
    | { name: string | string[]; unique?: boolean; sparse?: boolean }
  )[];
  defaults?: string;
  edgeCollection?: boolean;
  ensureDefaults?: boolean;
}

/**
 * @todo actually validate format?
 */
export function collection(_val: unknown): asserts _val is Collection {
  return;
}

const config = libConfig({
  arangodb: {
    ensureDefaults: {
      doc: 'Ensure the default (i.e., debug) documents are loaded',
      format: Boolean,
      nullable: true,
      default: null,
      // TODO: Rename?
      // This name for historical reasons
      env: 'arangodb__ensureDefaults',
    },
    connectionString: {
      doc: 'URI for connecting to arangodb',
      format: 'url',
      default: 'http://arangodb:8529',
      env: 'ARANGODB_URL',
    },
    database: {
      doc: 'database in arangodb to use',
      format: String,
      default: 'oada',
      env: 'ARANGODB_DATABASE',
    },
    collections: {
      users: {
        format: Object, //collection,,
        default: {
          name: 'users',
          indexes: ['username'],
          defaults: './libs/exampledocs/users',
        },
      },
      clients: {
        format: Object, //collection,,
        default: {
          name: 'clients',
          indexes: ['clientId'],
          defaults: './libs/exampledocs/clients',
        },
      },
      authorizations: {
        format: Object, //collection,,
        default: {
          name: 'authorizations',
          indexes: ['token', { name: 'user', unique: false }],
          defaults: './libs/exampledocs/authorizations',
        },
      },
      codes: {
        format: Object, //collection,,
        default: {
          name: 'codes',
          indexes: ['code'],
          defaults: './libs/exampledocs/codes',
        },
      },
      resources: {
        format: Object, //collection,,
        default: {
          name: 'resources',
          indexes: [],
          defaults: './libs/exampledocs/resources',
        },
      },
      graphNodes: {
        format: Object, //collection,,
        default: {
          name: 'graphNodes',
          indexes: [],
          defaults: './libs/exampledocs/graphNodes',
        },
      },
      changes: {
        format: Object, //collection,,
        default: {
          name: 'changes',
          indexes: [],
          defaults: './libs/exampledocs/changes',
        },
      },
      changeEdges: {
        format: Object, //collection,,
        default: {
          name: 'changeEdges',
          indexes: [{ name: 'name', unique: false }],
          defaults: './libs/exampledocs/changeEdges',
          edgeCollection: true,
        },
      },
      edges: {
        format: Object, //collection,,
        default: {
          name: 'edges',
          indexes: [{ name: 'name', unique: false }],
          defaults: './libs/exampledocs/edges',
          edgeCollection: true,
        },
      },
      putBodies: {
        format: Object, //collection,,
        default: {
          name: 'putBodies',
          indexes: [],
          defaults: './libs/exampledocs/putBodies',
          createOptions: { isVolatile: false },
        },
      },
      remoteResources: {
        format: Object, //collection,,
        default: {
          name: 'remoteResources',
          indexes: [{ name: ['domain', 'resource_id'], unique: true }],
        },
      },
      sessions: {
        format: Object, //collection,,
        default: {
          name: 'sessions',
          indexes: [],
          createOptions: { isVolatile: false },
        },
      },
      // Gross hack because convict types don't undertand assert
    } as Record<string, { default: Collection }>,
    retry: {
      deadlock: {
        retries: {
          format: 'int',
          default: 10,
        },
        delay: {
          format: 'int',
          default: 50,
        },
      },
    },
    aql: {
      profile: {
        doc: 'Whether to profile all AQL queries',
        format: 'int',
        default: false as false | 1 | 2,
        env: 'PROFILE_AQL',
        arg: 'profile-aql',
      },
    },
    init: {
      // NOTE: passwordSalt HAS to match the one in auth
      passwordSalt: {
        format: String,
        default: '$2a$10$l64QftVz6.7KR5BXNc29IO',
      },
      defaultData: {
        default: {} as Record<string, string>,
      },
    },
  },
});

export default config;
