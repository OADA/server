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

import cloneDeep from 'clone-deep';
import debug from 'debug';
import ksuid from 'ksuid';

const trace = debug('users:trace');
const warn = debug('users:warn');
const error = debug('users:error');

const contentTypes = {
  bookmarks: 'application/vnd.oada.bookmarks.1+json',
  shares: 'application/vnd.oada.shares.1+json',
};

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

export interface User {
  username: string;
  password?: string;
  domain?: string;
  name?: string;
  email?: string;
  oidc?: {
    sub?: string; // Subject, i.e. unique ID for this user
    iss?: string; // Issuer: the domain that gave out this ID
    username?: string; // Can be used to pre-link this account to openidconnect identity
  };
  scope?: readonly string[];
  // TODO: These don't really belong here...
  reqdomain?: string;
  bookmarks?: { _id: string };
  shares?: { _id: string };
}

export async function stopResp(): Promise<void> {
  return responder.disconnect();
}

async function createNewUser(request: UserRequest): Promise<users.User> {
  const _id =
    request.userid &&
    (request.userid.startsWith('users')
      ? request.userid
      : `users/${request.userid}`);
  const _key =
    request.userid &&
    (request.userid.startsWith('users')
      ? request.userid.replace(/^users\//, '')
      : request.userid);
  const { password, ...user } = await users.create({
    _id,
    _key,
    ...request.user,
  } as Omit<users.User, '_rev'>);
  // Create empty resources for user
  for await (const resource of ['bookmarks', 'shares'] as const) {
    // eslint-disable-next-line security/detect-object-injection
    if (!user[resource]?._id) {
      const { string: id } = await ksuid.random();
      const resourceID = `resources/${id}`;

      trace(
        'Creating %s for %s of %s as _type = %s',
        resourceID,
        resource,
        user._id,
        // eslint-disable-next-line security/detect-object-injection
        contentTypes[resource],
      );
      const resp = await responder.send({
        msgtype: 'write-request',
        url: `/${resourceID}`,
        resource_id: `/${resourceID}`,
        path_leftover: '',
        meta_id: `${resourceID}/_meta`,
        user_id: user._id,
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
  userid?: string;
  user: User;
  authorization?: {
    scope: string | readonly string[];
  };
}

export interface UserResponse {
  code: string;
  new: boolean;
  user?: users.User & { _id: users.UserID };
}
responder.on<UserResponse, UserRequest>('request', handleReq);

function isArray(value: unknown): value is unknown[] | readonly unknown[] {
  return Array.isArray(value);
}

export async function handleReq(request: UserRequest): Promise<UserResponse> {
  // TODO: Sanitize?
  trace('REQUEST: req.user = %O, userid = %s', request.user, request.userid);
  trace(
    'REQUEST: req.authorization.scope = %s',
    request.authorization ? request.authorization.scope : null,
  );
  // While this could fit in permissions_handler, since users are not really resources (i.e. no graph),
  // we'll add a check here that the user has oada.admin.user:write or oada.admin.user:all scope
  const authorization = cloneDeep(request.authorization) ?? { scope: '' };
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
  let currentUser = null;
  if (request.userid) {
    trace('Checking if user id %s exists.', request.userid);
    currentUser = await users.findById(request.userid, { graceful: true });
  }

  trace(
    'Result of search for user with id %s: %O',
    request.userid,
    currentUser,
  );

  // Make one if it doesn't exist already:
  let createUser = false;
  if (!currentUser) {
    try {
      createUser = true;
      currentUser = await createNewUser(request);
    } catch (cError: unknown) {
      if (
        cError instanceof ArangoError &&
        cError.errorNum === ArangoErrorCode.ARANGO_UNIQUE_CONSTRAINT_VIOLATED
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
        error(
          { error: cError },
          'Unknown error occurred when creating new user',
        );
        throw cError as Error;
      }
    }
  }

  // Now we know the user exists and has bookmarks/shares.  Now update/merge it with the requested data
  if (!createUser) {
    const { _id } = currentUser ?? {};
    trace(
      'We did not create a new user, so we are now updating user id %s',
      _id,
    );
    currentUser = await users.update({
      // Assume req.user is a full user now?
      ...request.user,
      _id: _id!,
    });
  }

  // All done!
  // Respond to the request with success:
  if (trace.enabled && currentUser) {
    // Don't log passwords
    const { password, ...user } =
      'new' in currentUser ? currentUser.new : currentUser;
    trace({ user }, 'Finished with update, responding with success');
  }

  return {
    code: 'success',
    new: createUser,
    // TODO: figure out what cur_user is supposed to be??
    user: currentUser as users.DBUser,
  };
}
