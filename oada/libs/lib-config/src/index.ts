/**
 * @license
 * Copyright 2017-2022 Open Ag Data Alliance
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

import 'dotenv/config';
import convict, { Config, Schema } from 'convict';
import json5 from 'json5';
// @ts-expect-error no types for this
import moment from 'convict-format-with-moment';
import validator from 'convict-format-with-validator';
import yaml from 'yaml';

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
// FIXME: Why did this start making TS hang?
// type D = typeof defaults extends Schema<infer D> ? D : never;

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
 * @param inSchema Config schema for your application
 * @see Schema
 */
export default async function config<S>(
  // Defer type inference
  inSchema: S extends unknown ? Schema<S> : never
) {
  // Merge input schema with default schema and create config
  const schema = convict({ ...defaults, ...inSchema });

  // Optionally load any config file(s)
  const files = schema.get('configfiles');
  for await (const file of files) {
    // Allow requiring a js config?
    // FIXME: Probably remove this
    if (['.js', '.mjs', '.cjs'].includes(extname(file))) {
      const configFile = (await import(file)) as { default?: unknown };
      schema.load(configFile.default ?? configFile); // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
    } else {
      schema.loadFile(file);
    }
  }

  // Ensure config is valid
  schema.validate({
    // Allow extra items
    allowed: 'warn',
    // Do not actually output warnings about extra items?
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    output() {},
  });

  return {
    config: schema as (S extends unknown ? Config<S> : never) & typeof schema,
    schema: inSchema,
  };
}
