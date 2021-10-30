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

import { join } from 'node:path';

import { authorizations, clients } from '@oada/lib-arangodb';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { v4 as uuid } from 'uuid';

export interface Options {
  prefix: string;
}

async function addClientToAuth(
  request: FastifyRequest,
  auth: authorizations.Authorization | null
) {
  if (auth?.clientId) {
    request.log.trace(
      'GET /%s: authorization has a client, retrieving',
      auth._id
    );
    try {
      const client = await clients.findById(auth.clientId);
      // Store client from db into authorization object
      return { client, ...auth };
    } catch (error: unknown) {
      request.log.error('ERROR: authorization clientId not found in DB');
      throw error;
    }
  } else {
    request.log.trace(
      'GET /%s: authorization DOES NOT have a clientId',
      auth?._id
    );
    return auth;
  }
}

const plugin: FastifyPluginAsync<Options> = async (fastify, options) => {
  // Authorizations routes
  // TODO: How the heck should this work??
  fastify.get('/', async (request, reply) => {
    const { user_id: userid } = request.requestContext.get('user')!;
    const auths = await authorizations.findByUser(userid);

    const response: Record<string, authorizations.Authorization | null> = {};
    for await (const auth of auths) {
      const k = auth._id.replace(/^authorizations\//, '');
      response[k] = await addClientToAuth(request, auth);
    }

    return reply.send(response);
  });

  fastify.get('/:authId', async (request, reply) => {
    const { authId } = request.params as { authId: string };
    const { user_id: userid } = request.requestContext.get('user')!;

    const auth = await authorizations.findById(authId);
    // Only let users see their own authorizations
    if (auth?.user._id !== userid) {
      reply.forbidden();
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
      // 20 MB
      bodyLimit: 20 * 1_048_576,
    },
    (_, body, done) => {
      // eslint-disable-next-line unicorn/no-null
      done(null, body);
    }
  );

  fastify.post('/', async (request, reply) => {
    const user = request.requestContext.get('user')!;

    // TODO: Most of this could be done inside an Arango query...
    // TODO: Check scope of current token
    const auth = {
      // TODO: Which fields should be selectable by the client?
      user: {
        _id: user.user_id,
      },
      clientId: user.client_id,
      createTime: Date.now(),
      expiresIn: 3600,
      // TODO: How to generate token?
      token: uuid(),
      ...(request.body as Record<string, unknown>),
    };

    // Don't allow making tokens for other users unless admin.user
    if (auth.user._id !== user.user_id) {
      if (
        !user.scope.some(
          (s) => s === 'oada.admin.user:all' || 'oada.admin.user:write'
        )
      ) {
        reply.forbidden();
        return;
      }

      // Otherwise, token has admin scope so allow it (check user too?)
      request.log.debug(
        'Posted authorization for a different user, but token has admin.user scope so we are allowing it'
      );
    }

    const result = await authorizations.save(auth);
    if (!result) {
      return null;
    }

    const { _rev, user: u, ...returnValue } = result;

    void reply.header(
      'Content-Location',
      join(options.prefix, returnValue._id)
    );
    return reply.send({ ...returnValue, user: u ? { _id: u._id } : undefined });
  });

  // TODO: Should another microservice revoke authorizations?
  fastify.delete('/:authId', async (request, reply) => {
    const { authId } = request.params as { authId: string };
    const user = request.requestContext.get('user')!;

    const auth = await authorizations.findById(authId);

    // Only let users see their own authorizations
    if (auth?.user._id !== user.user_id) {
      reply.forbidden();
      return;
    }

    await authorizations.revoke(authId);
    return reply.code(204).send();
  });

  return Promise.resolve();
};

export default plugin;
