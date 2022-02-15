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

import { libConfig } from '@oada/lib-config';

import type { CreateCollectionOptions } from 'arangojs/collection';

interface Collection {
  name: string;
  createOptions?: CreateCollectionOptions;
  indexes: Array<
    string | { name: string | string[]; unique?: boolean; sparse?: boolean }
  >;
  defaults?: string;
  edgeCollection?: boolean;
  ensureDefaults?: boolean;
}

/**
 * @todo actually validate format?
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function
export function collection(_value: unknown): asserts _value is Collection {}

const config = libConfig({
  arangodb: {
    ensureDefaults: {
      doc: 'Ensure the default (i.e., debug) documents are loaded',
      format: Boolean,
      nullable: true,
      default: null,
      // This name is for historical reasons
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
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    collections: {
      users: {
        format: Object, // Collection,,
        default: {
          name: 'users',
          indexes: ['username'],
          defaults: './libs/exampledocs/users.js',
        },
      },
      clients: {
        format: Object, // Collection,,
        default: {
          name: 'clients',
          indexes: ['clientId'],
          defaults: './libs/exampledocs/clients.js',
        },
      },
      authorizations: {
        format: Object, // Collection,,
        default: {
          name: 'authorizations',
          indexes: ['token', { name: 'user', unique: false }],
          defaults: './libs/exampledocs/authorizations.js',
        },
      },
      codes: {
        format: Object, // Collection,,
        default: {
          name: 'codes',
          indexes: ['code'],
          defaults: './libs/exampledocs/codes.js',
        },
      },
      resources: {
        format: Object, // Collection,,
        default: {
          name: 'resources',
          indexes: [],
          defaults: './libs/exampledocs/resources.js',
        },
      },
      graphNodes: {
        format: Object, // Collection,,
        default: {
          name: 'graphNodes',
          indexes: [],
          defaults: './libs/exampledocs/graphNodes.js',
        },
      },
      changes: {
        format: Object, // Collection,,
        default: {
          name: 'changes',
          indexes: [],
          defaults: './libs/exampledocs/changes.js',
        },
      },
      changeEdges: {
        format: Object, // Collection,,
        default: {
          name: 'changeEdges',
          indexes: [{ name: 'name', unique: false }],
          defaults: './libs/exampledocs/changeEdges.js',
          edgeCollection: true,
        },
      },
      edges: {
        format: Object, // Collection,,
        default: {
          name: 'edges',
          indexes: [{ name: 'name', unique: false }],
          defaults: './libs/exampledocs/edges.js',
          edgeCollection: true,
        },
      },
      putBodies: {
        format: Object, // Collection,,
        default: {
          name: 'putBodies',
          indexes: [],
          defaults: './libs/exampledocs/putBodies.js',
          createOptions: { isVolatile: false },
        },
      },
      remoteResources: {
        format: Object, // Collection,,
        default: {
          name: 'remoteResources',
          indexes: [{ name: ['domain', 'resource_id'], unique: true }],
        },
      },
      sessions: {
        format: Object, // Collection,,
        default: {
          name: 'sessions',
          indexes: [],
          createOptions: { isVolatile: false },
        },
      },
      // Gross hack because convict types don't understand assert
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
        default: 0 as 0 | 1 | 2,
        env: 'PROFILE_AQL',
        arg: 'profile-aql',
      },
    },
    init: {
      // NOTE: passwordSalt HAS to match the one in auth
      passwordSalt: {
        format: String,
        default: '',
      },
      defaultData: {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        default: {} as Record<string, string>,
      },
    },
  },
  isTest: {
    format: Boolean,
    default: process.env.NODE_ENV === 'test',
  },
});

export default config;
