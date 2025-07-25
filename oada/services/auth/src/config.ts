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

import type { File } from "node:buffer";
import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";
import type { jwksUtils as jwku } from "@oada/certs";
import { schema as arangoSchema } from "@oada/lib-arangodb/dist/config.js";
import libConfig, { addFormats } from "@oada/lib-config";
import debug from "debug";
import URI from "urijs";

const trace = debug("auth#config:trace");
const warn = debug("auth#config:warn");

const dataStores = await fs.readdir(
  path.join(path.dirname(url.fileURLToPath(import.meta.url)), "db"),
);
addFormats({
  dataStore: {
    validate(value: unknown) {
      const values = Array.isArray(value) ? value : `${value}`.split(",");
      return values.every((v) => dataStores.includes(`${v}`));
    },
    coerce(value: unknown) {
      return Array.isArray(value) ? value : `${value}`.split(",");
    },
  },
});

export const { config, schema } = await libConfig({
  trustProxy: {
    format: Array,
    default: ["uniquelocal"],
    env: "TRUST_PROXY",
    arg: "trust-proxy",
  },
  ...arangoSchema,
  domainsDir: {
    format: String,
    default: "/oada/services/auth/domains",
  },
  auth: {
    server: {
      rateLimit: {
        enabled: {
          doc: "Have the oada server handle rate-limiting (usually should be handled in a reverse-proxy instead)",
          format: Boolean,
          default: false,
          env: "RATE_LIMIT_ENABLED",
          arg: "rate-limit-enabled",
        },
        useDraftSpec: {
          doc: "see https://www.ietf.org/archive/id/draft-ietf-httpapi-ratelimit-headers-06.txt",
          format: Boolean,
          default: false,
          env: "RATE_LIMIT_DRAFT_SPEC",
          arg: "rate-limit-draft-spec",
        },
        maxRequests: {
          format: "int",
          default: 5,
          env: "MAX_WRITE_REQUESTS",
          arg: "max-write-requests",
        },
        timeWindow: {
          doc: "time window in ms to use for rate-limiting",
          format: "duration",
          default: 1000,
          env: "RATE_TIME_WINDOW",
          arg: "rate-time-window",
        },
        redis: {
          doc: "Redis URI to use for rate-limit storage",
          format: String,
          nullable: true,

          default: null as string | null,
          env: "REDIS_URI",
          arg: "redis-uri",
        },
      },
      session: {
        key: {
          format: String,
          sensitive: true,
          nullable: true,

          default: null as string | null,
          env: "SESSION_KEY",
        },
        secret: {
          format: String,
          sensitive: true,
          default: "averylogphrasebiggerthanthirtytwochars",
          env: "SESSION_SECRET",
        },
        salt: {
          doc: "Predefined salt to use for key derivation",
          format: String,
          sensitive: true,
          nullable: true,

          default: null as string | null,
          env: "SESSION_SALT",
        },
      },
      "port-http": {
        format: "port",
        default: 80,
      },
      "port-https": {
        format: "port",
        default: 443,
      },
      port: {
        format: "port",
        nullable: true,

        default: null as null | number,
        env: "PORT",
        arg: "port",
      },
      mode: {
        format: ["http", "https"],
        default: "https",
      },
      domain: {
        format: String,
        default: "localhost",
        env: "DOMAIN",
        arg: "domain",
      },
      publicUri: {
        format: "url",

        default: null as null | string | URL,
        nullable: true,
      },
      proxy: {
        description: "Whether to trust reverse-proxy headers",
        formats: Boolean,
        default: false,
      },
    },
    wkj: {
      default: null,
    },
    endpointsPrefix: {
      doc: "So you can place this under a sub-path in your domain",
      format: String,
      default: "/oadaauth/",
      env: "AUTH_PREFIX",
    },
    endpoints: {
      register: {
        format: String,
        default: "register",
      },
      authorize: {
        format: String,
        default: "authorization",
      },
      token: {
        format: String,
        default: "token",
      },
      deviceAuthorization: {
        format: String,
        default: "device-authorization",
      },
      activate: {
        format: String,
        default: "activate",
      },
      decision: {
        format: String,
        default: "decision",
      },
      login: {
        format: String,
        default: "login",
      },
      // POST URL for OpenIDConnect domain web form
      oidcLogin: {
        format: String,
        default: "oidc-login",
      },
      logout: {
        format: String,
        default: "logout",
      },
      certs: {
        format: String,
        default: "certs",
      },
      userinfo: {
        format: String,
        default: "userinfo",
      },
    },
    // Views controls what name is used for the EJS template in the views/ folder for
    // various pages. For now, there's just login. In the future can also add the allow
    // page. is allows other services to override the login page itself with their
    // own custom one via docker-compose.
    views: {
      basedir: {
        format: String,
        default: "/oada/services/auth/views",
      },
      loginPage: {
        format: String,
        default: "login",
      },
      approvePage: {
        format: String,
        default: "approve",
      },
    },
    oauth2: {
      enable: {
        format: Boolean,
        default: true,
      },
      requirePKCE: {
        format: Boolean,
        default: true,
      },
      allowImplicitFlows: {
        format: Boolean,
        default: process.env.NODE_ENV === "development",
      },
    },
    oidc: {
      enable: {
        format: Boolean,
        default: true,
      },
    },
    dynamicRegistration: {
      softwareStatement: {
        require: {
          description:
            "Whether to require all clients send a software_statement to register",
          format: Boolean,
          default: false,
        },
        mustTrust: {
          description:
            "Whether to outright reject clients with untrusted software_statement",
          format: Boolean,
          default: false,
        },
        mustInclude: {
          description: "List of field that any software_statement must include",
          format: Array,
          default: ["software_id"],
        },
      },
      trustedListLookupTimeout: {
        format: "duration",
        default: 5000,
      },
    },
    code: {
      dataStore: {
        format: "dataStore",
        default: "jwt" as string | string[],
        env: "AUTH_CODE_DATA_STORE",
      },
      expiresIn: {
        format: String,
        default: "10 seconds",
      },
      key: {
        doc: "Key to use for encrypting codes",
        format: "file-url",
        nullable: true,
        default: null as unknown as Promise<File | undefined>,
        env: "AUTH_KEY_CODE",
      },
      alg: {
        doc: "Algorithm to use for encrypting codes",
        format: String,
        default: "HS256" as "HS256" | "RS256" | "PS256",
      },
      pkce: {
        required: {
          format: Boolean,
          default: process.env.NODE_ENV === "development",
        },
        allowPlainTransform: {
          format: Boolean,
          default: process.env.NODE_ENV === "development",
        },
      },
    },
    deviceCode: {
      dataStore: {
        format: "dataStore",
        default: "arango" as string | string[],
        env: "AUTH_DEVICE_CODE_DATA_STORE",
      },
      expiresIn: {
        format: "duration",
        default: "10 minutes" as unknown as number,
      },
    },
    token: {
      dataStore: {
        format: "dataStore",
        default: "jwt" as string | string[],
        env: "AUTH_TOKEN_DATA_STORE",
      },
      expiresIn: {
        format: "duration",
        default: Number.MAX_VALUE,
      },
      key: {
        doc: "Key to use for signing tokens",
        format: "file-url",
        nullable: true,
        default: null as unknown as Promise<File | undefined>,
        env: "AUTH_KEY_TOKEN",
      },
      alg: {
        doc: "Algorithm to use for signing tokens",
        format: String,
        default: "RS256" as "HS256" | "RS256" | "PS256",
      },
    },
    idToken: {
      /*
      DataStore: {
        format: 'dataStore',
        default: 'jwt' as string | string[],
        env: 'AUTH_ID_TOKEN_DATA_STORE',
      },
      */
      expiresIn: {
        format: "duration",
        default: 0,
      },
      key: {
        doc: "Private key to use for signing id tokens",
        format: "file-url",
        nullable: true,
        default: null as unknown as Promise<File | undefined>,
        env: "AUTH_KEY_ID_TOKEN",
      },
      alg: {
        doc: "Algorithm to use for signing id tokens",
        format: String,
        default: "RS256" as "HS256" | "RS256" | "PS256",
      },
    },
    client: {
      dataStore: {
        format: "dataStore",
        default: "arango" as string | string[],
        env: "AUTH_CLIENT_DATA_STORE",
      },
    },
    user: {
      dataStore: {
        format: "dataStore",
        default: "arango" as string | string[],
        env: "AUTH_USER_DATA_STORE",
      },
    },
    certs: {
      // If you want to run in https mode you need certs here.
      key: {
        // Default: fs.readFileSync(path.join(__dirname, 'certs/ssl/server.key')),
        default: null,
      },
      cert: {
        // Default: fs.readFileSync(path.join(__dirname, 'certs/ssl/server.crt')),
        default: null,
      },
      ca: {
        // Default: fs.readFileSync(path.join(__dirname, 'certs/ssl/ca.crt')),
        default: null,
      },
      requestCrt: {
        format: Boolean,
        default: true,
      },
      rejectUnauthorized: {
        format: Boolean,
        default: true,
      },
    },
    hint: {
      username: {
        format: String,
        default: "frank",
      },
      password: {
        format: String,
        sensitive: true,
        default: "test",
      },
    },
    init: {
      format: String,
      default: "",
    },
  },
});

// Set port default based on mode?
if (config.get("auth.server.port") === null) {
  switch (config.get("auth.server.mode")) {
    case "https": {
      config.set("auth.server.port", 443);
      break;
    }

    case "http": {
      config.set("auth.server.port", 80);
      break;
    }

    default: {
      throw new TypeError(`Unknown mode: ${config.get("auth.server.mode")}`);
    }
  }
}

// -----------------------------------------------------------------------
// Load all the domain configs at startup
const domainsDirectory = config.get("domainsDir");
trace("using domainsDir = %s", domainsDirectory);
export const domainConfigs = new Map<string, DomainConfig>();
export interface DomainConfig {
  domain: string;
  baseuri: string;
  name?: string;
  logo?: string;
  tagline?: string;
  color?: string;
  hint?: unknown;
  idService?: {
    shortname: string;
    longname: string;
  };
  software_statement?: string;
  keys: {
    private: jwku.JWK;
  };
}

// eslint-disable-next-line security/detect-non-literal-fs-filename
for await (const dirname of await fs.readdir(domainsDirectory)) {
  if (dirname.startsWith(".")) {
    continue;
  }

  const fname = path.join(domainsDirectory, dirname, "config");
  for await (const extensions of ["js", "mjs", "cjs"] as const) {
    try {
      const { default: dConfig } = await import(`${fname}.${extensions}`); // Nosemgrep: javascript.lang.security.detect-non-literal-require.detect-non-literal-require
      domainConfigs.set(dConfig.domain, dConfig);
      break;
    } catch (cError: unknown) {
      warn(cError, `Could not read config for domain ${dirname}, skipping`);
    }
  }
}

const publicUri = config.get("auth.server.publicUri")
  ? new URI(config.get("auth.server.publicUri")).normalize().toString()
  : new URI()
      .hostname(config.get("auth.server.domain"))
      .port(`${config.get("auth.server.port")}`)
      .protocol(config.get("auth.server.mode"))
      .normalize()
      .toString();
config.set("auth.server.publicUri", publicUri);
