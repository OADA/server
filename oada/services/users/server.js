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

'use strict';

const debug = require('debug');
const trace = debug('users:trace');
const warn = debug('users:warn');
const error = debug('users:error');
const ksuid = require('ksuid');
const cloneDeep = require('clone-deep');

const { ResponderRequester } = require('@oada/lib-kafka');
const { users } = require('@oada/lib-arangodb');
const config = require('./config');
const contentTypes = {
  bookmarks: 'application/vnd.oada.bookmarks.1+json',
  shares: 'application/vnd.oada.shares.1+json',
};

const responder = new ResponderRequester({
  requestTopics: {
    produceTopic: config.get('kafka:topics:writeRequest'),
    consumeTopic: config.get('kafka:topics:httpResponse'),
  },
  respondTopics: {
    consumeTopic: config.get('kafka:topics:userRequest'),
    produceTopic: config.get('kafka:topics:httpResponse'),
  },
  group: 'user-handlers',
});

module.exports = function stopResp() {
  return responder.disconnect();
};

function createNewUser(req) {
  const u = cloneDeep(req.user);
  u._id = 'users/' + req.userid;
  u._key = req.userid;
  return users
    .create(u)
    .then((user) => {
      // Create empty resources for user
      ['bookmarks', 'shares'].forEach((res) => {
        if (!(user[res] && user[res]['_id'])) {
          let resid = 'resources/' + ksuid.randomSync().string;

          trace(
            `Creating ${resid} for ${res} of ${user._id} as _type = ${contentTypes[res]}`
          );
          user[res] = responder
            .send({
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
            })
            .tap((resp) => {
              if (resp.code === 'success') {
                return Promise.resolve();
              } else {
                // TODO: Clean up on failure?
                trace(resp.code);
                let err = new Error(`Failed to create ${res}`);
                return Promise.reject(err);
              }
            })
            .return({ _id: resid });
        }
      });
      // If we keep the password, we end up re-hashing it in the update
      delete user.password;
      return user;
    })
    .props()
    .then(users.update) // update the new user with the new bookmarks
    .tap((user) => trace(`Created user ${user['_id']}`));
}

responder.on('request', async function handleReq(req) {
  try {
    // TODO: Sanitize?
    trace('REQUEST: req.user = %O, userid = %s', req.user, req.userid);
    trace(
      'REQUEST: req.authorization.scope = %s',
      req.authorization ? req.authorization.scope : null
    );
    // While this could fit in permissions_handler, since users are not really resources (i.e. no graph),
    // we'll add a check here that the user has oada.admin.user:write or oada.admin.user:all scope
    const authorization = cloneDeep(req.authorization) || {};
    const tokenscope = Array.isArray(authorization.scope)
      ? authorization.scope.join(' ')
      : authorization.scope || ''; // force to space-separated string
    if (
      !tokenscope.match(/oada.admin.user:write/) &&
      !tokenscope.match(/oada.admin.user:all/)
    ) {
      warn(
        'WARNING: attempt to create a user, but request does not have token with oada.admin.user:write or oada.admin.user:all scope'
      );
      return {
        code: 'ERROR: token does not have required scope to create users.',
      };
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
      } catch (err) {
        if (err && err.errorNum === users.UniqueConstraintError.errorNum) {
          created_a_new_user = false;
          trace(
            'Tried to create user, but it already existed (same username).  Returning as if we had created it.  User object was: %O',
            req.user
          );
          cur_user = (await users.like({ username: req.user.username }))[0];
          trace('existing user found as: %O', cur_user);
        } else {
          error(
            'FAILED: unknown error occurred when creating new user. Error was: %O',
            err
          );
          throw err;
        }
      }
    }

    // Now we know the user exists and has bookmarks/shares.  Now update/merge it with the requested data
    if (!created_a_new_user) {
      trace(
        'We did not create a new user, so we are now updating user id %s',
        cur_user._id
      );
      const u = cloneDeep(req.user); // Get the "update" merge body
      u._id = cur_user._id; // Add the correct _id (overwrite any incorrect one)
      cur_user = await users.update(u);
    }

    // All done!
    // Respond to the request with success:
    trace('Finished with update, responding with success, user = %O', cur_user);
    return {
      code: 'success',
      new: created_a_new_user,
      user: cur_user,
    };

    // If anything else went wrong, respond with error
  } catch (err) {
    error(err);
    return { code: err.message || 'error' };
  }
});
