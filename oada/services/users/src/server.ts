/* Copyright 2017 Open Ag Data Alliance
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

import { users } from '@oada/lib-arangodb';
import { ResponderRequester } from '@oada/lib-kafka';

import config from './config.js';

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
  for (const res of <const>['bookmarks', 'shares']) {
    if (!user[res]?._id) {
      const resID = `resources/${(await ksuid.random()).string}`;

      trace(
        'Creating %s for %s of %s as _type = %s',
        resID,
        res,
        user._id,
        contentTypes[res]
      );
      const resp = await responder.send({
        msgtype: 'write-request',
        url: `/${resID}`,
        resource_id: `/${resID}`,
        path_leftover: '',
        meta_id: `${resID}/_meta`,
        user_id: user._id,
        // TODO: What to put for these?
        // 'authorizationid': ,
        // 'client_id': ,
        contentType: contentTypes[res],
        body: {},
      });
      if (resp?.code !== 'success') {
        // TODO: Clean up on failure?
        trace(resp.code);
        throw new Error(`Failed to create ${res}`);
      }

      user[res] = { _id: resID };
    }
  }

  // Update the new user with the new bookmarks
  await users.update(user);
  trace('Created user %s', user._id);

  return { password, ...user };
}

export interface UserRequest {
  userid?: string;
  user: {
    username: string;
    password: string;
    bookmarks?: { _id: string };
    shares?: { _id: string };
    scope?: string[];
  };
  authorization?: {
    scope: string | string[];
  };
}

export interface UserResponse {
  code: string;
  new: boolean;
  user: users.User & { _id: string };
}
responder.on<UserResponse, UserRequest>('request', handleReq);

export async function handleReq(request: UserRequest): Promise<UserResponse> {
  // TODO: Sanitize?
  trace('REQUEST: req.user = %O, userid = %s', request.user, request.userid);
  trace(
    'REQUEST: req.authorization.scope = %s',
    request.authorization ? request.authorization.scope : null
  );
  // While this could fit in permissions_handler, since users are not really resources (i.e. no graph),
  // we'll add a check here that the user has oada.admin.user:write or oada.admin.user:all scope
  const authorization = cloneDeep(request.authorization) || { scope: '' };
  const tokenscope = Array.isArray(authorization.scope)
    ? authorization.scope.join(' ')
    : authorization.scope; // Force to space-separated string
  if (
    !/oada.admin.user:write/.test(tokenscope) &&
    !/oada.admin.user:all/.test(tokenscope)
  ) {
    warn(
      'WARNING: attempt to create a user, but request does not have token with oada.admin.user:write or oada.admin.user:all scope'
    );
    throw new Error('Token does not have required scope to create users.');
  }

  // First, check if the ID exists already:
  let current_user = null;
  if (request.userid) {
    trace('Checking if user id %s exists.', request.userid);
    current_user = await users.findById(request.userid, { graceful: true });
  }

  trace(
    'Result of search for user with id %s: %O',
    request.userid,
    current_user
  );

  // Make one if it doesn't exist already:
  let created_a_new_user = false;
  if (!current_user) {
    try {
      created_a_new_user = true;
      current_user = await createNewUser(request);
    } catch (error_: unknown) {
      if (
        error_ &&
        typeof error_ === 'object' &&
        'errorNum' in error_ &&
        (error_ as { errorNum: number }).errorNum ===
          users.UniqueConstraintError.errorNum
      ) {
        created_a_new_user = false;
        trace(
          request.user,
          'Tried to create user, but it already existed (same username). Returning as if we had created it'
        );
        const like = await users.like({ username: request.user.username });
        for await (const user of like) {
          trace(user, 'existing user found');
        }
      } else {
        error(error_, 'Unknown error occurred when creating new user');
        throw error_;
      }
    }
  }

  // Now we know the user exists and has bookmarks/shares.  Now update/merge it with the requested data
  if (!created_a_new_user) {
    const { _id } = current_user ?? {};
    trace(
      'We did not create a new user, so we are now updating user id %s',
      _id
    );
    current_user = await users.update({
      // Assume req.user is a full user now?
      ...request.user,
      _id: _id!,
    });
  }

  // All done!
  // Respond to the request with success:
  trace(current_user, 'Finished with update, responding with success');
  return {
    code: 'success',
    new: created_a_new_user,
    // TODO: figure out what cur_user is supposed to be??
    user: current_user as users.User,
  };
}
