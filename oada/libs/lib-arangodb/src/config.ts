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

import libConfig from '@oada/lib-config';

import type { CreateCollectionOptions } from 'arangojs/collection.js';
import type { EdgeDefinitionOptions } from 'arangojs/graph.js';

export interface Collection {
  name: string;
  createOptions?: CreateCollectionOptions;
  indexes: Array<
    string | { name: string | string[]; unique?: boolean; sparse?: boolean }
  >;
  defaults?: string;
  edgeCollection?: boolean;
  ensureDefaults?: boolean;
}

export interface Graph {
  name: string;
  edges: EdgeDefinitionOptions[];
}

/**
 * @todo actually validate format?
 */

export function collection(_value: unknown): asserts _value is Collection {}

export const { config, schema } = await libConfig({
  arangodbImport: {
    connectionString: {
      doc: 'URI for connecting to arangodb',
      format: 'url',
      default: 'http://arangodb:8529',
      env: 'ARANGODB_IMPORT_URL',
      arg: 'arangodb-import-url',
    },
    database: {
      doc: 'database in arangodb to use',
      format: String,
      default: 'oada',
      env: 'ARANGODB_IMPORT_DATABASE',
      arg: 'arangodb-import-database',
    },
    batchSize: {
      format: 'nat',
      default: 10,
      env: 'ARANGODB_IMPORT_BATCH_SIZE',
      arg: 'arangodb-import-batch-size',
    },
    overwriteMode: {
      format: ['replace', 'update', 'ignore'],
      default: 'replace' as 'replace' | 'update' | 'ignore',
      env: 'ARANGODB_IMPORT_OVERWRITE_MODE',
      arg: 'arangodb-import-overwrite-mode',
    },
    auth: {
      username: {
        doc: 'Username for arangodb authentication',
        format: String,
        default: 'root',
        env: 'ARANGODB_IMPORT_USERNAME',
        arg: 'arangodb-import-username',
      },
      password: {
        doc: 'Password for arangodb authentication',
        format: String,
        sensitive: true,
        default: '',
        env: 'ARANGODB_IMPORT_PASSWORD',
        arg: 'arangodb-import-password',
      },
    },
  },
  arangodb: {
    ensureDefaults: {
      doc: 'Ensure the default (i.e., debug) documents are loaded',
      format: Boolean,
      nullable: true,
      // eslint-disable-next-line unicorn/no-null
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
    auth: {
      username: {
        doc: 'Username for arangodb authentication',
        format: String,
        default: 'root',
        env: 'ARANGODB_USERNAME',
      },
      password: {
        doc: 'Password for arangodb authentication',
        format: String,
        sensitive: true,
        default: '',
        env: 'ARANGODB_PASSWORD',
      },
    },

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
      // HACK: convict types don't understand assert
    } as Record<string, { default: Collection }>,

    graphs: {
      resources: {
        format: Object, // Graph,,
        default: {
          name: 'resources',
          edges: [
            {
              collection: 'edges',
              to: 'graphNodes',
              from: 'graphNodes',
            },
          ],
        },
      },
      changes: {
        format: Object, // Graph,,
        default: {
          name: 'changes',
          edges: [
            {
              collection: 'changeEdges',
              to: 'changes',
              from: 'changes',
            },
          ],
        },
      },
    } as Record<string, { default: Graph }>,
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
      defaultData: {
        default: {} as Record<string, string>,
      },
    },
  },
  bcrypt: {
    saltRounds: {
      doc: 'Number of rounds to use for bcrypt salt generation',
      format: 'nat',
      default: 10,
      env: 'BCRYPT_SALT_ROUNDS',
      arg: 'bcrypt-salt-rounds',
    },
    salt: {
      doc: 'Predefined salt to use for bcrypt hashing',
      format: String,
      sensitive: true,
      nullable: true,

      // eslint-disable-next-line unicorn/no-null
      default: null as string | null,
      env: 'BCRYPT_SALT',
    },
  },
  isTest: {
    format: Boolean,
    default: process.env.NODE_ENV === 'test',
  },
});

if (config.get('isTest')) {
  const database = config.get('arangodb.database');
  config.set('arangodb.database', `${database}-test`);
}
