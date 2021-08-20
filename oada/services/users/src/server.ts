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
import type { User } from '@oada/lib-arangodb/dist/libs/users';
import { ResponderRequester } from '@oada/lib-kafka';

import config from './config';

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

export function stopResp(): Promise<void> {
  return responder.disconnect();
}

async function createNewUser(req: UserRequest): Promise<User> {
  const _id =
    req.userid &&
    (/^users/.exec(req.userid) ? req.userid : 'users/' + req.userid);
  const _key =
    req.userid &&
    (/^users/.exec(req.userid)
      ? req.userid.replace(/^users\//, '')
      : req.userid);
  const { password, ...user } = await users.create({
    _id,
    _key,
    ...req.user,
  } as Omit<User, '_rev'>);
  // Create empty resources for user
  for (const res of <const>['bookmarks', 'shares']) {
    if (!user[res]?._id) {
      const resid = 'resources/' + (await ksuid.random()).string;

      trace(
        'Creating %s for %s of %s as _type = %s',
        resid,
        res,
        user._id,
        contentTypes[res]
      );
      const resp = await responder.send({
        msgtype: 'write-request',
        url: '/' + resid,
        resource_id: '/' + resid,
        path_leftover: '',
        meta_id: resid + '/_meta',
        user_id: user['_id'],
        // TODO: What to put for these?
        //'authorizationid': ,
        //'client_id': ,
        contentType: contentTypes[res],
        body: {},
      });
      if (resp?.code !== 'success') {
        // TODO: Clean up on failure?
        trace(resp.code);
        throw new Error(`Failed to create ${res}`);
      }
      user[res] = { _id: resid };
    }
  }

  // update the new user with the new bookmarks
  await users.update(user);
  trace('Created user %s', user['_id']);

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
  user: User & { _id: string };
}
responder.on<UserResponse, UserRequest>('request', handleReq);

export async function handleReq(req: UserRequest): Promise<UserResponse> {
  // TODO: Sanitize?
  trace('REQUEST: req.user = %O, userid = %s', req.user, req.userid);
  trace(
    'REQUEST: req.authorization.scope = %s',
    req.authorization ? req.authorization.scope : null
  );
  // While this could fit in permissions_handler, since users are not really resources (i.e. no graph),
  // we'll add a check here that the user has oada.admin.user:write or oada.admin.user:all scope
  const authorization = cloneDeep(req.authorization) || { scope: '' };
  const tokenscope = Array.isArray(authorization.scope)
    ? authorization.scope.join(' ')
    : authorization.scope; // force to space-separated string
  if (
    !/oada.admin.user:write/.exec(tokenscope) &&
    !/oada.admin.user:all/.exec(tokenscope)
  ) {
    warn(
      'WARNING: attempt to create a user, but request does not have token with oada.admin.user:write or oada.admin.user:all scope'
    );
    throw new Error('Token does not have required scope to create users.');
  }

  // First, check if the ID exists already:
  let cur_user = null;
  if (req.userid) {
    trace('Checking if user id %s exists.', req.userid);
    cur_user = await users.findById(req.userid, { graceful: true });
  }
  trace('Result of search for user with id %s: %O', req.userid, cur_user);

  // Make one if it doesn't exist already:
  let created_a_new_user = false;
  if (!cur_user) {
    try {
      created_a_new_user = true;
      cur_user = await createNewUser(req);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === 'object' &&
        'errorNum' in err &&
        (err as { errorNum: number }).errorNum ===
          users.UniqueConstraintError.errorNum
      ) {
        created_a_new_user = false;
        trace(
          req.user,
          'Tried to create user, but it already existed (same username). Returning as if we had created it'
        );
        const like = await users.like({ username: req.user.username });
        for await (const user of like) {
          trace(user, 'existing user found');
        }
      } else {
        error(err, 'Unknown error occurred when creating new user');
        throw err;
      }
    }
  }

  // Now we know the user exists and has bookmarks/shares.  Now update/merge it with the requested data
  if (!created_a_new_user) {
    const { _id } = cur_user ?? {};
    trace(
      'We did not create a new user, so we are now updating user id %s',
      _id
    );
    cur_user = await users.update({
      // Assume req.user is a full user now?
      ...req.user,
      _id: _id as string,
    });
  }

  // All done!
  // Respond to the request with success:
  trace(cur_user, 'Finished with update, responding with success');
  return {
    code: 'success',
    new: created_a_new_user,
    // TODO: figure out what cur_user is supposed to be??
    user: cur_user as User,
  };
}
