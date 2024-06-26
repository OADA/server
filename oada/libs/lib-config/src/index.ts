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

/* eslint-disable unicorn/no-null */

import { File } from 'node:buffer';
import { extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

import 'dotenv/config';
import convict, { type Config, type Schema } from 'convict';
import json5 from 'json5';
// @ts-expect-error no types for this
import moment from 'convict-format-with-moment';
import validator from 'convict-format-with-validator';
import yaml from 'yaml';

import '@oada/pino-debug';
import log from 'debug';

const debug = log('@oada/lib-config:debug');

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
  oidc: {
    issuer: {
      doc: 'OpenID Connect/Oauth2.0 issuer to use for auth',
      format: 'url',

      default: null as null | URL | string,
      nullable: true,
      env: 'OIDC_ISSUER',
      arg: 'oidc-issuer',
    },
  },
};
// FIXME: Why did this start making TS hang?
// type D = typeof defaults extends Schema<infer D> ? D : never;

// Add more formats to convict
convict.addFormats(validator);

convict.addFormats(moment);

function fileUrl(pathOrUrl: string) {
  try {
    return new URL(pathOrUrl);
  } catch {
    return pathToFileURL(pathOrUrl);
  }
}

function readFileUrl(url: URL) {
  const buffer = readFileSync(url);
  return new File([buffer], url.pathname);
}

function readDataUrl(url: URL) {
  const { groups } =
    /^(?<type>[^,;]*)(?:;(?<charset>[^,]*))?,(?<data>.*)$/.exec(url.pathname)!;
  const { type = 'text/plain', charset = 'ascii', data } = groups!;
  const buffer = Buffer.from(data!, charset as BufferEncoding);
  return new File([buffer], url.pathname, { type });
}

convict.addFormat({
  name: 'file-url',
  validate(value: unknown) {
    if (value instanceof File) {
      return;
    }

    if (typeof value !== 'string') {
      throw new TypeError('must be a string or File');
    }

    const url = fileUrl(value);
    switch (url.protocol) {
      case 'file:':
      case 'data:': {
        break;
      }

      default: {
        throw new TypeError(`Unsupported protocol: ${url.protocol}`);
      }
    }
  },

  coerce(value: string) {
    const url = fileUrl(value);
    switch (url.protocol) {
      case 'file:': {
        return readFileUrl(url);
      }

      case 'data:': {
        return readDataUrl(url);
      }

      default: {
        throw new TypeError(`Unsupported protocol: ${url.protocol}`);
      }
    }
  },
});

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
export default async function loadConfig<S>(
  // Defer type inference
  inSchema: S,
) {
  try {
    type C = S extends Schema<infer T> ? Config<T> : never;
    // Merge input schema with default schema and create config
    const config = convict({ ...defaults, ...inSchema });

    // Optionally load any config file(s)
    const files = config.get('configfiles');
    for await (const file of files) {
      // Allow requiring a js config?
      // FIXME: Probably remove this
      if (['.js', '.mjs', '.cjs'].includes(extname(file))) {
        const configFile = (await import(file)) as { default?: unknown };
        config.load(configFile.default ?? configFile); // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
      } else {
        config.loadFile(file);
      }
    }

    // Ensure config is valid
    config.validate({
      // Allow extra items
      allowed: 'warn',
      // Do not actually output warnings about extra items?

      output() {},
    });

    if (debug.enabled) {
      debug(
        {
          config: JSON.parse(`${config}`) as unknown,
        },
        'Config loaded successfully',
      );
    }

    return {
      config: config as C & typeof config,
      schema: inSchema,
    };
  } catch (error: unknown) {
    throw new Error('Failed to load config', { cause: error });
  }
}
