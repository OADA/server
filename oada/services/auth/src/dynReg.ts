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

import { config } from './config.js';

import type { RequestHandler } from 'express';
import debug from 'debug';

import { validate } from '@oada/certs';

import { IClient, save } from './db/models/client.js';

const error = debug('oada-ref-auth:dynReg:error');
const info = debug('oada-ref-auth:dynReg:info');
const trace = debug('oada-ref-auth:dynReg:trace');

const dynReg: RequestHandler = async (request, response) => {
  try {
    if (!request.body?.software_statement) {
      info(
        request.body,
        'Request body does not have software_statement key. Did you remember content-type=application/json?'
      );
      response.status(400).json({
        error: 'invalid_client_registration_body',
        error_description:
          'POST to Client registration must include a software_statement in the body',
      });
      return;
    }

    const { payload, trusted, valid, details } = await validate.validate(
      request.body.software_statement,
      {
        timeout: config.get(
          'auth.dynamicRegistration.trustedListLookupTimeout'
        ),
      }
    );
    const clientcert = {
      ...((typeof payload === 'string'
        ? JSON.parse(payload)
        : payload) as IClient),
      // Set the "trusted" status based on JWS library return value
      valid,
      trusted,
    };

    // Must have contacts, client_name, and redirect_uris or we won't save it
    if (
      !clientcert.contacts ||
      !clientcert.client_name ||
      !clientcert.redirect_uris
    ) {
      response.status(400).json({
        error: 'invalid_software_statement',
        error_description:
          'Software statement must include at least client_name, redirect_uris, and contacts',
      });
      return;
    }

    if (!valid) {
      response.status(400).json({
        error: 'invalid_software_statement',
        error_description: `Software statement was not a valid JWT. Details on rejection = ${JSON.stringify(
          details,
          null,
          '  '
        )}`,
      });
      return;
    }

    // If scopes is listed in the body, check them to make sure they are in the software_statement, then
    // replace the signed ones with the subset given in the body
    const { scope } = (request.body ?? {}) as { scope?: string };
    if (typeof scope === 'string') {
      const possiblescopes = (clientcert.scope ?? '').split(' ');
      const subsetscopes = scope.split(' ');
      const finalscopes = subsetscopes.filter((s) =>
        possiblescopes.includes(s)
      );
      clientcert.scope = finalscopes.join(' ');
    }

    // ------------------------------------------
    // Save client to database, return client_id for their future OAuth2 requests
    trace(
      'Saving client %s registration, trusted = %s',
      clientcert.client_name,
      trusted
    );
    try {
      const client = await save(clientcert);
      const result = {
        ...clientcert,
        clientId: undefined,
        client_id: client.clientId,
      };
      info(
        'Saved new client ID %s to DB, client_name = %s',
        result.client_id,
        result.client_name
      );
      response.status(201).json(result);
    } catch (cError: unknown) {
      error(cError, 'Failed to save new dynReg client');
      response.status(400).json({
        error: 'invalid_client_registration',
        error_description: `Unexpected error - Client registration could not be stored. Err = ${cError}`,
      });
    }

    // If @oada/certs fails
  } catch (cError: unknown) {
    error(
      'Failed to validate client registration, oada-certs threw error: %O',
      cError
    );
    response.status(400).json({
      error: 'invalid_client_registration',
      error_description:
        'Client registration failed decoding or had invalid signature.',
    });
  }
};

export default dynReg;
