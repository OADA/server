/**
 * @license
 * Copyright 2024 Open Ag Data Alliance
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

/* eslint-disable @typescript-eslint/naming-convention */

import { randomBytes } from "node:crypto";

import type { OmitIndexSignature, Opaque, ReadonlyDeep } from "type-fest";

import type Metadata from "@oada/types/oauth-dyn-reg/response.js";
import { destructure } from "./decorators.js";
import { generate } from "xksuid";
import { makeClass } from "@qlever-llc/interface2class";

export type ClientID = Opaque<string, Client>;

export const DEFAULT_SCOPES = "";

/**
 * Representation of an API client within OADA
 */
export
@destructure
class Client extends makeClass<ReadonlyDeep<OmitIndexSignature<Metadata>>>() {
  // @ts-expect-error HACK
  constructor(client?: Partial<Client>);

  constructor(
    rest: Partial<Client> = {},

    override readonly client_id: ClientID,
    override readonly client_id_issued_at?: number,
    override readonly scope = DEFAULT_SCOPES,
    override readonly grant_types: Metadata["grant_types"] = [
      "authorization_code",
    ],
    override readonly response_types: Metadata["response_types"] = ["code"],
    override readonly application_type: Metadata["application_type"] = "web",
    readonly puc?: string,
    readonly licenses: ReadonlyArray<{ id: string; name: string }> = [],
    readonly trusted?: boolean,
    override readonly client_secret?: string,
    override readonly client_secret_expires_at?: number,
    readonly registration_provider?: string,
  ) {
    super({ client_id, ...rest });

    if (!client_id) {
      this.client_id = `clients/${generate()}` as ClientID;
      this.client_id_issued_at = Date.now() / 1000;
    }

    // TODO: More client secret logic/configurability
    if (this.application_type === "native" && !client_secret) {
      this.client_secret = randomBytes(256).toString("hex");
      this.client_secret_expires_at = 0;
    }
  }
}

export default Client;
