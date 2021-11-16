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

import { extname } from 'node:path';

import convict, { Config, Schema } from 'convict';
// eslint-disable-next-line
// @ts-ignore
import moment from 'convict-format-with-moment';
import validator from 'convict-format-with-validator';
import { config as load } from 'dotenv';
import json5 from 'json5';
import yaml from 'yaml';

// Load .env into environment
load();

// Builtin part of the config schema
const defaults = {
  configfiles: {
    doc: 'Optional list of config file(s) to load',
    format: Array,
    default: [] as string[],
    env: 'CONFIG',
    arg: 'config',
  },
  // IDK what this is about but it was around before...
  isTest: {
    format: Boolean,
    default: false,
    env: 'isTest',
  },
  /**
   * By default, this checks for NODE_ENV===production
   * to determine if is production.
   * set to true to use the production database name
   * and prevent init.cleanup() from being called.
   */
  isProduction: {
    format: Boolean,
    default: process.env.NODE_ENV === 'production',
    env: 'isProduction',
  },
};
type D = typeof defaults extends Schema<infer D> ? D : never;

// Add more formats to convict
convict.addFormats(validator);
convict.addFormats(moment);

// Add support for JSON, JSON5, and yaml config files
convict.addParser([
  // { extension: 'js', parse: require },
  { extension: 'json', parse: JSON.parse },
  { extension: 'json5', parse: json5.parse },
  { extension: ['yml', 'yaml'], parse: yaml.parse },
]);

/**
 * Using schema `schema`, load and parse the config.
 *
 * @param schema Config schema for your application
 * @see Schema
 */
export function libConfig<S>(schema: Schema<S>): Config<S & D> {
  // Merge input schema with default schema and create config
  const config = convict({ ...defaults, ...schema } as Schema<S & D>);

  // Optionally load any config file(s)
  const files = config.get('configfiles');
  for (const file of files) {
    if (extname(file) === '.js') {
      // Allow requiring a js config?
      // TODO: Probably remove this later
      // eslint-disable-next-line  @typescript-eslint/no-var-requires
      config.load(require(file)); // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
    } else {
      config.loadFile(file);
    }
  }

  // Ensure config is valid
  config.validate({
    // Allow extra items
    allowed: 'warn',
    // Do not actually output warnings about extra items?
    output: () => {},
  });

  return config;
}

export default libConfig;

export { default as convict } from 'convict';
