/**
 * @license
 * Copyright 2017-2023 Open Ag Data Alliance
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

import { config } from './config.js';

import type { FastifyPluginAsync } from 'fastify';

import {
  type default as Metadata,
  assert as assertMetadata,
  schema,
} from '@oada/types/oauth-dyn-reg/metadata.js';
import { validate } from '@oada/certs';

import type { IClient } from './db/models/client.js';
import { save } from './db/models/client.js';

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2}
 */
export const enum RegistrationErrorCode {
  InvalidRedirectURI = 'invalid_redirect_uri',
  InvalidClientMetadata = 'invalid_client_metadata',
  InvalidSoftwareStatement = 'invalid_software_statement',
  UnapprovedSoftwareStatement = 'unapproved_software_statement',
}

/**
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591#section-3.2.2}
 */
export class RegistrationError extends Error {
  readonly code;

  constructor(code: RegistrationErrorCode, message?: string) {
    super(message);
    this.code = code;
  }

  toJSON() {
    return {
      error: this.code,
      error_description: this.message,
    };
  }
}

const {
  require: requireSS,
  mustInclude,
  mustTrust,
} = config.get('auth.dynamicRegistration.softwareStatement');
const timeout = config.get('auth.dynamicRegistration.trustedListLookupTimeout');

async function getSoftwareStatement({
  software_statement: softwareStatement,
}: Metadata) {
  if (!softwareStatement) {
    return;
  }

  const { payload, trusted, valid, details } = await validate.validate(
    softwareStatement,
    { timeout }
  );
  if (!valid) {
    throw new RegistrationError(
      RegistrationErrorCode.InvalidSoftwareStatement,
      `Software statement was not a valid JWT. Details = "${details}"`
    );
  }

  const statements: unknown =
    typeof payload === 'string' ? JSON.parse(payload) : payload;
  assertMetadata(statements);
  return {
    ...statements,
    // Set the "trusted" status based on JWS library return value
    trusted,
  };
}

export interface Options {
  endpoints?: {
    register?: string;
  };
}

/**
 * Plugin for handling dynamic client registration
 * @see {@link https://datatracker.ietf.org/doc/html/rfc7591}
 */
const plugin: FastifyPluginAsync<Options> = async (
  fastify,
  { endpoints: { register = 'register' } = {} }
) => {
  fastify.post(
    register,
    { schema: { body: schema } },
    async (request, reply) => {
      try {
        // TODO: Make fastify type provider work
        const metadata = request.body as Metadata;

        const softwareStatement = await getSoftwareStatement(metadata);

        if (requireSS && !softwareStatement) {
          request.log.error(
            metadata,
            'Request body does not have software_statement key. Did you remember content-type=application/json?'
          );
          throw new RegistrationError(
            // FIXME: What is the correct code here??
            RegistrationErrorCode.InvalidSoftwareStatement,
            'Client registration MUST include a software_statement for this server'
          );
        }

        if (mustTrust && !softwareStatement?.trusted) {
          request.log.error(
            metadata,
            'Request body does not have a trusted software_statement'
          );
          throw new RegistrationError(
            RegistrationErrorCode.UnapprovedSoftwareStatement,
            'Client registration MUST include a software_statement for this server'
          );
        }

        if (
          softwareStatement &&
          !mustInclude.every((statement) => statement in softwareStatement)
        ) {
          throw new RegistrationError(
            RegistrationErrorCode.InvalidSoftwareStatement,
            `Software statement must include at least ${mustInclude}`
          );
        }

        // Fields in software statement MUST take precedence
        const registrationData = { ...metadata, ...softwareStatement };

        // TODO: Allow generating client_secret for "confidential" clients?
        // ???: How to tell it is a confidential client?
        if ('client_secret' in registrationData) {
          throw new Error(
            'Client secret is not allowed in dynamic registration'
          );
        }

        // ------------------------------------------
        // Save client to database, return client_id for their future OAuth2 requests
        request.log.trace(
          'Saving client %s registration, trusted = %s',
          registrationData.client_name,
          registrationData.trusted
        );
        const client = await save(registrationData as IClient);
        const result = {
          ...registrationData,
          client_id: client.client_id,
        };
        request.log.info(
          'Saved new client ID %s to DB, client_name = %s',
          result.client_id,
          result.client_name
        );
        void reply.code(201);
        return result;
      } catch (error: unknown) {
        request.log.error(error, 'Failed to validate client registration');
        if (error instanceof RegistrationError) {
          void reply.code(400);
          return error;
        }

        void reply.code(400);
        return new RegistrationError(
          RegistrationErrorCode.InvalidClientMetadata,
          `Client registration failed: ${(error as Error)?.message ?? error}`
        );
      }
    }
  );
};

export default plugin;
