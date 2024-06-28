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

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

import { authorizations, clients } from '@oada/lib-arangodb';
import Authorization from '@oada/models/authorization';

export interface Options {
  prefix: string;
}

async function addClientToAuth(
  request: FastifyRequest,

  auth: authorizations.Authorization | undefined,
) {
  if (auth?.clientId) {
    request.log.trace(
      'GET /%s: authorization has a client, retrieving',
      auth._id,
    );
    try {
      const client = await clients.findById(auth.clientId);
      // Store client from db into authorization object
      return { client, ...auth };
    } catch (error: unknown) {
      request.log.error({ error }, 'Authorization clientId not found in DB');
      throw error;
    }
  } else {
    request.log.trace(
      'GET /%s: authorization DOES NOT have a clientId',
      auth?._id,
    );
    return auth;
  }
}

// eslint-disable-next-line @typescript-eslint/require-await
const plugin: FastifyPluginAsync<Options> = async (fastify, _options) => {
  // Authorizations routes
  // TODO: How the heck should this work??
  fastify.get('/', async (request, reply) => {
    const results = await authorizations.findByUser(request.user!._id);

    const response: Record<string, authorizations.Authorization | undefined> =
      {};
    for await (const auth of results) {
      const k = auth._id.replace(/^authorizations\//, '');
      response[k] = await addClientToAuth(request, auth);
    }

    return reply.send(response);
  });

  fastify.get('/:authId', async (request, reply) => {
    const { authId } = request.params as { authId: string };
    const { _id: userid } = request.user!;

    const auth = await authorizations.findById(authId);
    // Only let users see their own authorizations
    if (auth?.user._id !== userid) {
      void reply.forbidden();
      return;
    }

    // Get the full client out of the DB to send out with this auth document
    // That way anybody listing authorizations can print the name, etc. of the client
    const response = await addClientToAuth(request, auth);
    return reply.send(response);
  });

  // Parse JSON content types
  fastify.addContentTypeParser(
    ['json', '+json'],
    {
      parseAs: 'string',
      // 20 MB
      bodyLimit: 20 * 1_048_576,
    },
    (_, body, done) => {
      try {
        const json: unknown = JSON.parse(body as string);
        // eslint-disable-next-line unicorn/no-null
        done(null, json);
      } catch (error: unknown) {
        done(error as Error);
      }
    },
  );

  fastify.post('/', async (request, reply) => {
    // TODO: Most of this could be done inside an Arango query...
    // TODO: Check scope of current token
    const auth = new Authorization({
      // TODO: Which fields should be selectable by the client?
      exp: 3600,
      sub: request.user!.sub,
      ...(request.body as Partial<Authorization>),
      client_id: request.user!.client_id,
    });

    // Don't allow making tokens for other users unless admin.user
    if (auth.sub !== request.user!.sub) {
      if (
        !request.user!.roles.some(
          (s: string) => s === 'oada.admin.user:all' || 'oada.admin.user:write',
        )
      ) {
        void reply.forbidden();
        return;
      }

      // Otherwise, token has admin scope so allow it (check user too?)
      request.log.debug(
        'Posted authorization for a different user, but token has admin.user scope so we are allowing it',
      );
    }

    // TODO: Support saving authorizations in arango instead of only JWTs
    /*
    const result = await authorizations.save(auth);
    if (!result) {
      // eslint-disable-next-line unicorn/no-null
      return null;
    }

    const { user: u, ...returnValue } = result;

    void reply.header(
      'Content-Location',
      join(options.prefix, returnValue._id),
    );
    return reply.send({ ...returnValue, user: u ? { _id: u._id } : undefined });
    */
    return reply.send(auth);
  });

  // TODO: Should another microservice revoke authorizations?
  fastify.delete('/:authId', async (request, reply) => {
    const { authId } = request.params as { authId: string };

    const auth = await authorizations.findById(authId);

    // Only let users see their own authorizations
    if (auth?.user._id !== request.user!._id) {
      void reply.forbidden();
      return;
    }

    await authorizations.revoke(authId);
    return reply.code(204).send();
  });
};

export default plugin;
