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

import '@oada/pino-debug';

import { config } from './config.js';

import '@oada/lib-prom';

import { ArangoError, ArangoErrorCode, users } from '@oada/lib-arangodb';
import { ResponderRequester } from '@oada/lib-kafka';

import debug from 'debug';
import ksuid from 'ksuid';

import type { SetRequired } from 'type-fest';
import { User } from '@oada/models/user';
export type * from '@oada/models/user';

const trace = debug('users:trace');
const warn = debug('users:warn');

const contentTypes = {
  bookmarks: 'application/vnd.oada.bookmarks.1+json',
  shares: 'application/vnd.oada.shares.1+json',
} as const;

const responder = new ResponderRequester({
  requestTopics: {
    produceTopic: config.get('kafka.topics.writeRequest'),
    consumeTopic: config.get('kafka.topics.httpResponse'),
  },
  respondTopics: {
    consumeTopic: config.get('kafka.topics.userRequest'),
    produceTopic: config.get('kafka.topics.httpResponse'),
  },
  group: 'user-handlers',
});

export async function stopResp(): Promise<void> {
  return responder.disconnect();
}

export async function createNewUser(request: UserRequest): Promise<User> {
  const u = new User(request.user);
  const { password, ...user } = await users.create(u);
  // Create empty resources for user
  for await (const resource of ['bookmarks', 'shares'] as const) {
    // eslint-disable-next-line security/detect-object-injection
    if (!user[resource]?._id) {
      const { string: resourceId } = await ksuid.random();
      const resourceID = `resources/${resourceId}`;

      trace(
        'Creating %s for %s of %s as _type = %s',
        resourceID,
        resource,
        user.sub,
        // eslint-disable-next-line security/detect-object-injection
        contentTypes[resource],
      );
      const resp = await responder.send({
        msgtype: 'write-request',
        url: `/${resourceID}`,
        resource_id: `/${resourceID}`,
        path_leftover: '',
        meta_id: `${resourceID}/_meta`,
        user_id: user.sub,
        // TODO: What to put for these?
        // 'authorizationid': ,
        // 'client_id': ,

        // eslint-disable-next-line security/detect-object-injection
        contentType: contentTypes[resource],
        body: {},
      });
      if (resp?.code !== 'success') {
        // TODO: Clean up on failure?
        trace(resp.code);
        throw new Error(`Failed to create ${resource}`);
      }

      // eslint-disable-next-line security/detect-object-injection
      user[resource] = { _id: resourceID };
    }
  }

  // Update the new user with the new bookmarks
  await users.update(user);
  trace({ user }, 'Created user');

  return { password, ...user };
}

export interface UserRequest {
  user: SetRequired<Partial<User>, 'domain'>;
  authorization?: {
    scope: string | readonly string[];
  };
}

export interface UserResponse {
  code: string;
  new: boolean;
  user?: User;
}
responder.on<UserResponse, UserRequest>('request', handleReq);

function isArray(value: unknown): value is unknown[] | readonly unknown[] {
  return Array.isArray(value);
}

export async function handleReq(request: UserRequest): Promise<UserResponse> {
  // TODO: Sanitize?
  trace({ request }, 'User request');
  // While this could fit in permissions_handler, since users are not really resources (i.e. no graph),
  // we'll add a check here that the user has oada.admin.user:write or oada.admin.user:all scope
  const authorization = structuredClone(request.authorization) ?? { scope: '' };
  const tokenscope = isArray(authorization.scope)
    ? authorization.scope.join(' ')
    : authorization.scope; // Force to space-separated string
  if (
    !/oada.admin.user:write/.test(tokenscope) &&
    !/oada.admin.user:all/.test(tokenscope)
  ) {
    warn(
      'Attempted to create a user, but request does not have token with oada.admin.user:write or oada.admin.user:all scope',
    );
    throw new Error('Token does not have required scope to create users.');
  }

  // First, check if the ID exists already:
  let currentUser: User | undefined;
  const userId = request.user.sub;
  if (userId) {
    trace('Checking if user id %s exists.', userId);
    currentUser = await users.findById(userId, { graceful: true });
  }

  trace('Result of search for user with id %s: %O', userId, currentUser);

  // Make one if it doesn't exist already:
  let createUser = false;
  if (!currentUser) {
    try {
      createUser = true;
      currentUser = await createNewUser(request);
    } catch (cError: unknown) {
      if (
        cError instanceof ArangoError &&
        (cError.errorNum as ArangoErrorCode) ===
          ArangoErrorCode.ARANGO_UNIQUE_CONSTRAINT_VIOLATED
      ) {
        createUser = false;
        trace(
          { user: request.user },
          'Tried to create user, but it already existed (same username). Returning as if we had created it',
        );
        const like = await users.like({ username: request.user.username });
        for await (const user of like) {
          trace(user, 'existing user found');
        }
      } else {
        throw Object.assign(
          new Error(`Error creating User ${request.user.username}`, {
            cause: cError,
          }),
          cError,
        );
      }
    }
  }

  // Now we know the user exists and has bookmarks/shares.  Now update/merge it with the requested data
  if (!createUser) {
    const { sub } = currentUser ?? {};
    trace(
      'We did not create a new user, so we are now updating user id %s',
      sub,
    );
    currentUser = await users.update({
      // Assume req.user is a full user now?
      ...request.user,
      sub: sub!,
    });
  }

  // All done!
  // Respond to the request with success:
  if (trace.enabled && currentUser) {
    // Don't log passwords
    const { password, ...user } = currentUser;
    trace({ user }, 'Finished with update, responding with success');
  }

  return {
    code: 'success',
    new: createUser,
    // TODO: figure out what cur_user is supposed to be??
    user: currentUser,
  };
}
