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

import fs from "node:fs/promises";
import path from "node:path";
import url from "node:url";

import signed from "./signed_software_statement.mjs";
import unsigned from "./unsigned_software_statement.mjs";

export default {
  domain: "localhost", // Just here for informational purposes
  baseuri: "https://localhost/", // Just here for informational purposes
  logo: "logo.png",
  name: "Open Ag Data Alliance",
  tagline: "",
  color: "#FFFFFF",
  hint: {
    username: "frank",
    password: "test",
  },
  idService: {
    shortname: "OADA",
    longname: "Open Ag Data Alliance",
  },

  // To generate keys:
  // 1: create key pair: openssl genrsa -out private_key.pem 2048
  // 2: extract public key: openssl rsa -pubout -in private_key.pem -out public_key.pem
  keys: {
    public: "public_key.pem",
    private: {
      // Use the first (and only) key in software statement:
      kid: unsigned.jwks.keys[0].kid,
      // Read the private key from the private key file:
      // @eslint-disable-next-line security/detect-non-literal-fs-filename
      pem: await fs.readFile(
        `${path.dirname(url.fileURLToPath(import.meta.url))}/private_key.pem`,
      ),
    },
  },
  unsigned_software_statement: unsigned,
  software_statement: signed,
};
