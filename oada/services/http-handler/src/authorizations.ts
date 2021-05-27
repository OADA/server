/* Copyright 2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { join } from 'path';

import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { v4 as uuid } from 'uuid';

import { authorizations, clients } from '@oada/lib-arangodb';

import type { TokenResponse } from './tokenLookup';

export interface Options {
  prefix: string;
}

const plugin: FastifyPluginAsync<Options> = async function (fastify, opts) {
  async function addClientToAuth(
    req: FastifyRequest,
    auth: authorizations.Authorization | null
  ) {
    if (auth?.clientId) {
      req.log.trace(
        'GET /%s: authorization has a client, retrieving',
        auth._id
      );
      try {
        const client = await clients.findById(auth.clientId);
        // store client from db into authorization object
        return { client, ...auth };
      } catch (err) {
        req.log.error('ERROR: authorization clientId not found in DB');
        throw err;
      }
    } else {
      req.log.trace(
        'GET /%s: authorization DOES NOT have a clientId',
        auth?._id
      );
      return auth;
    }
  }

  // Authorizations routes
  // TODO: How the heck should this work??
  fastify.get('/', async function (request, reply) {
    const { user_id: userid } = request.requestContext.get<
      TokenResponse['doc']
    >('user')!;
    const auths = await authorizations.findByUser(userid);

    const res: Record<string, authorizations.Authorization | null> = {};
    for (const auth of auths) {
      const k = auth['_id'].replace(/^authorizations\//, '');
      res[k] = await addClientToAuth(request, auth);
    }

    return reply.send(res);
  });

  fastify.get('/:authId', async function (request, reply) {
    const { authId } = request.params as { authId: string };
    const { user_id: userid } = request.requestContext.get<
      TokenResponse['doc']
    >('user')!;

    const auth = await authorizations.findById(authId);
    // Only let users see their own authorizations
    if (auth?.user['_id'] !== userid) {
      return reply.forbidden();
    }

    // Get the full client out of the DB to send out with this auth document
    // That way anybody listing authorizations can print the name, etc. of the client
    const res = await addClientToAuth(request, auth);
    return reply.send(res);
  });

  // Parse JSON content types
  fastify.addContentTypeParser(
    ['json', '+json'],
    {
      // 20 MB
      bodyLimit: 20 * 1048576,
    },
    (_, body, done) => done(null, body)
  );

  fastify.post('/', async function (request, reply) {
    const user = request.requestContext.get<TokenResponse['doc']>('user')!;

    // TODO: Most of this could be done inside an Arango query...
    // TODO: Check scope of current token
    let auth = Object.assign(
      {
        // TODO: Which fields should be selectable by the client?
        user: {
          _id: user['user_id'],
        },
        clientId: user['client_id'],
        createTime: Date.now(),
        expiresIn: 3600,
        // TODO: How to generate token?
        token: uuid(),
      },
      request.body
    );

    // Don't allow making tokens for other users unless admin.user
    if (auth.user['_id'] !== user['user_id']) {
      if (
        !user.scope.find(
          (s) => s === 'oada.admin.user:all' || 'oada.admin.user:write'
        )
      ) {
        return reply.forbidden();
      }

      // otherwise, token has admin scope so allow it (check user too?)
      request.log.debug(
        'Posted authorization for a different user, but token has admin.user scope so we are allowing it'
      );
    }

    const result = await authorizations.save(auth);
    if (!result) {
      return null;
    }

    const {
      // @ts-ignore
      _rev,
      user: u,
      ...ret
    } = result;

    reply.header('Content-Location', join(opts.prefix, ret._id));
    return reply.send({ ...ret, user: u ? { _id: u._id } : undefined });
  });

  // TODO: Should another microservice revoke authorizations?
  fastify.delete('/:authId', async function (request, reply) {
    const { authId } = request.params as { authId: string };
    const user = request.requestContext.get<TokenResponse['doc']>('user')!;

    const auth = await authorizations.findById(authId);

    // Only let users see their own authorizations
    if (auth?.user['_id'] !== user['user_id']) {
      return reply.forbidden();
    }

    await authorizations.revoke(authId);
    return reply.code(204).send();
  });
};

export default plugin;