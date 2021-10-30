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

import { users } from '@oada/lib-arangodb';

import type { UserRequest, UserResponse } from '@oada/users';

import config from './config.js';
import requester from './requester.js';

import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import ksuid from 'ksuid';

export interface Options {
  prefix: string;
}

const plugin: FastifyPluginAsync<Options> = function (fastify, opts) {
  function sanitizeDbResult(user: users.User | null) {
    if (!user) {
      return null;
    }
    const { _rev, password, ...u } = user;
    return u;
  }

  // Parse JSON content types
  fastify.addContentTypeParser(
    ['json', '+json'],
    {
      // 20 MB
      bodyLimit: 20 * 1048576,
    },
    (_, body, done) => done(null, body)
  );

  async function requestUserWrite(req: FastifyRequest, id: string) {
    const authorization = req.requestContext.get('user');
    // TODO: Sanitize POST body?
    const resp = (await requester.send(
      {
        connection_id: req.id as string,
        domain: req.hostname,
        token: authorization,
        authorization,
        user: req.body,
        userid: id, // need for PUT, ignored for POST
      } as UserRequest,
      config.get('kafka.topics.userRequest')
    )) as UserResponse;

    switch (resp.code) {
      case 'success':
        return resp;
      default:
        throw new Error('write failed with code ' + resp.code);
    }
  }

  fastify.post('/', async function (request, reply) {
    request.log.info('Users POST, body = %O', request.body);
    // Note: if the username already exists, the ksuid() below will end up
    // silently discarded and replaced in the response with the real one.
    const { string: newID } = await ksuid.random(); // generate a random string for ID
    // generate an ID for this particular request
    if (!request.id) {
      request.id = (await ksuid.random()).string;
    }
    const resp = await requestUserWrite(request, newID);
    // TODO: Better status code choices?
    // if db didn't send back a user, it was an update so use id from URL
    const id = resp?.user?._id?.replace(/^users\//, '') ?? newID;
    // return res.redirect(201, req.baseUrl + '/' + id)
    void reply.header('content-location', join(opts.prefix, id));
    return reply.code(201).send();
  });

  // Update (merge) a user:
  fastify.put('/:id', async function (request, reply) {
    const { id } = request.params as { id: string };
    request.log.debug('Users PUT(id: %s), body = %O', id, request.body);
    // generate an ID for this particular request
    if (!request.id) {
      request.id = (await ksuid.random()).string;
    }
    const resp = await requestUserWrite(request, id);
    // TODO: Better status code choices?
    // if db didn't send back a user, it was an update so use id from URL
    const userid = resp?.user?._id.replace(/^users\//, '') ?? id;
    // return res.redirect(201, req.baseUrl + '/' + id)
    void reply.header('content-location', join(opts.prefix, userid));
    return reply.code(201).send();
  });

  // Lookup a username, limited to tokens and users with oada.admin.user scope
  fastify.get('/username-index/:uname', async function (request, reply) {
    const { uname } = request.params as { uname: string };
    const authorization = request.requestContext.get('user')!;

    // Check token scope
    request.log.trace(
      'username-index: Checking token scope, req.authorization.scope = %s',
      authorization
    );
    const havetokenscope = authorization.scope.find(
      (s) => s === 'oada.admin.user:read' || s === 'oada.admin.user:all'
    );
    if (!havetokenscope) {
      request.log.warn(
        'Attempt to lookup user by username (username-index), but token does not have oada.admin.user:read or oada.admin.user:all scope!'
      );
      return reply.unauthorized(
        'Token does not have required oada.admin.user scope'
      );
    }

    // Check user's scope
    request.log.trace(
      'username-index: Checking user scope, req.user = %O',
      authorization
    );
    const haveuserscope =
      Array.isArray(authorization.user_scope) &&
      (authorization.user_scope as string[]).find(
        (s) => s === 'oada.admin.user:read' || s === 'oada.admin.user:all'
      );
    if (!haveuserscope) {
      request.log.warn(
        'Attempt to lookup user by username (username-index), but USER does not have oada.admin.user:read or oada.admin.user:all scope!'
      );
      return reply.forbidden(
        'USER does not have required oada.admin.user scope'
      );
    }

    const u = sanitizeDbResult(await users.findByUsername(uname));
    if (!u) {
      request.log.info(
        '#username-index: 404: username %s does not exist',
        uname
      );
      return reply.notFound(`Username ${uname} does not exist.`);
    }
    request.log.info(
      '#username-index: found user, returning info for userid %s',
      u._id
    );
    return reply
      .header('Content-Location', join(opts.prefix, u._id))
      .type('application/vnd.oada.user.1+json')
      .status(200)
      .send(u);
  });

  fastify.get('/me', async function (request, reply) {
    const { user_id: id } = request.requestContext.get('user')!;
    await replyUser(id, reply);
  });

  //TODO: don't return stuff to anyone anytime
  fastify.get('/:id', async function (request, reply) {
    const { id } = request.params as { id: string };
    await replyUser(id, reply);
  });

  async function replyUser(id: string, reply: FastifyReply) {
    const { password, ...user } = (await users.findById(id)) ?? {};
    // See if a user came back
    if (Object.keys(user).length === 0) {
      return reply.notFound;
    }
    void reply.header('Content-Location', join(opts.prefix, id));
    return reply.send(user);
  }

  return Promise.resolve();
};

export default plugin;
