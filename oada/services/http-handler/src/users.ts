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

import { users } from '@oada/lib-arangodb';

import type { UserRequest, UserResponse } from '@oada/users';

import { config } from './config.js';
import requester from './requester.js';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import ksuid from 'ksuid';

export interface Options {
  prefix: string;
}

function sanitizeDatabaseResult(user: users.DBUser | undefined) {
  if (!user) {
    return;
  }

  const { _rev, password, ...u } = user;
  return u;
}

async function requestUserWrite(request: FastifyRequest, id: string) {
  const { user: authorization, hostname, body } = request;
  // TODO: Sanitize POST body?
  const resp = (await requester.send(
    {
      connection_id: request.id,
      domain: hostname,
      token: authorization,
      authorization,
      user: body,
      userid: id, // Need for PUT, ignored for POST
    } as UserRequest,
    config.get('kafka.topics.userRequest'),
  )) as UserResponse;

  // eslint-disable-next-line sonarjs/no-small-switch
  switch (resp.code) {
    case 'success': {
      return resp;
    }

    default: {
      throw new Error(`write failed with code ${resp.code}`);
    }
  }
}

const plugin: FastifyPluginAsync<Options> = async (fastify, options) => {
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
    request.log.trace({ body: request.body }, 'Users POST');
    // Note: if the username already exists, the ksuid() below will end up
    // silently discarded and replaced in the response with the real one.
    const { string: newID } = await ksuid.random(); // Generate a random string for ID
    // generate an ID for this particular request
    if (!request.id) {
      const { string: rid } = await ksuid.random();
      request.id = rid;
    }

    const resp = await requestUserWrite(request, newID);
    // TODO: Better status code choices?
    // if db didn't send back a user, it was an update so use id from URL
    const id = resp?.user?._id?.replace(/^users\//, '') ?? newID;
    // Return res.redirect(201, req.baseUrl + '/' + id)
    void reply.header('content-location', join(options.prefix, id));
    return reply.code(201).send();
  });

  // Update (merge) a user:
  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    request.log.debug('Users PUT(id: %s), body = %O', id, request.body);
    // Generate an ID for this particular request
    if (!request.id) {
      const { string: rid } = await ksuid.random();
      request.id = rid;
    }

    const resp = await requestUserWrite(request, id);
    // TODO: Better status code choices?
    // if db didn't send back a user, it was an update so use id from URL
    const userid = resp?.user?._id.replace(/^users\//, '') ?? id;
    // Return res.redirect(201, req.baseUrl + '/' + id)
    void reply.header('content-location', join(options.prefix, userid));
    return reply.code(201).send();
  });

  // Lookup a username, limited to tokens and users with oada.admin.user scope
  fastify.get('/username-index/:uname', async (request, reply) => {
    const { uname } = request.params as { uname: string };
    const authorization = request.user;

    // Check token scope
    request.log.trace(
      'username-index: Checking token scope, req.authorization.scope = %s',
      authorization,
    );
    const havetokenscope = authorization.scope.find(
      (s) => s === 'oada.admin.user:read' || s === 'oada.admin.user:all',
    );
    if (!havetokenscope) {
      request.log.warn(
        'Attempt to lookup user by username (username-index), but token does not have oada.admin.user:read or oada.admin.user:all scope!',
      );
      void reply.unauthorized(
        'Token does not have required oada.admin.user scope',
      );
      return;
    }

    // Check user's scope
    request.log.trace(authorization, 'username-index: Checking user scope');
    const haveuserscope =
      Array.isArray(authorization.user_scope) &&
      (authorization.user_scope as string[]).find(
        (s) => s === 'oada.admin.user:read' || s === 'oada.admin.user:all',
      );
    if (!haveuserscope) {
      request.log.warn(
        'Attempt to lookup user by username (username-index), but USER does not have oada.admin.user:read or oada.admin.user:all scope!',
      );
      void reply.forbidden('USER does not have required oada.admin.user scope');
      return;
    }

    const u = sanitizeDatabaseResult(await users.findByUsername(uname));
    if (!u) {
      request.log.info(
        '#username-index: 404: username %s does not exist',
        uname,
      );
      void reply.notFound(`Username ${uname} does not exist.`);
      return;
    }

    request.log.info(
      '#username-index: found user, returning info for userid %s',
      u._id,
    );
    return reply
      .header('Content-Location', join(options.prefix, u._id))
      .type('application/vnd.oada.user.1+json')
      .status(200)
      .send(u);
  });

  fastify.get('/me', async (request, reply) => {
    await replyUser(request.user.user_id, reply);
  });

  // TODO: don't return stuff to anyone anytime
  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    await replyUser(id, reply);
  });

  async function replyUser(id: string, reply: FastifyReply) {
    const { password, ...user } = (await users.findById(id)) ?? {};
    // See if a user came back
    if (Object.keys(user).length === 0) {
      return reply.notFound;
    }

    void reply.header('Content-Location', join(options.prefix, id));
    return reply.send(user);
  }
};

export default plugin;
