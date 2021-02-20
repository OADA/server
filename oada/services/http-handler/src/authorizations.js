'use strict';

const Promise = require('bluebird');
const express = require('express');
const { v4: uuid } = require('uuid');
const cloneDeep = require('clone-deep');

const debug = require('debug');
const trace = debug('http-handler#authorizations:trace');
const info = debug('http-handler#authorizations:info');

const { authorizations, clients } = require('@oada/lib-arangodb');
const { OADAError } = require('oada-error');

var router = express.Router(); // eslint-disable-line new-cap

function addClientToAuth(auth) {
  if (auth && auth.clientId) {
    trace('GET /' + auth._id + ': authorization has a client, retrieving');
    return clients
      .findById(auth.clientId)
      .then((client) => {
        auth.client = client; // store client from db into authorization object
        return auth;
      })
      .catch((err) => {
        debug.error('ERROR: authorization clientId not found in DB');
        throw err;
      });
  } else {
    trace('GET /' + auth._id + ': authorization DOES NOT have a clientId');
    return auth;
  }
}

// Authorizations routes
// TODO: How the heck should this work??
router.get('/', function (req, res, next) {
  return authorizations
    .findByUser(req.user['user_id'])
    .reduce((o, i) => {
      let k = i['_id'].replace(/^authorizations\//, '');
      i = addClientToAuth(i); // returns either a promise or the same auth object
      o[k] = i;
      return o;
    }, {})
    .then(res.json)
    .catch(next);
});

router.get('/:authId', function (req, res, next) {
  return authorizations
    .findById(req.params.authId)
    .tap(function chkAuthUser(auth) {
      // Only let users see their own authorizations
      try {
        if (auth.user['_id'] === req.user['user_id']) {
          return Promise.resolve();
        }
      } catch (e) {} // eslint-disable-line no-empty

      return Promise.reject(new OADAError('Forbidden', 403));

      // Get the full client out of the DB to send out with this auth document
      // That way anybody listing authorizations can print the name, etc. of the client
    })
    .then(addClientToAuth)
    .then(res.json)
    .catch(next);
});

router.post(
  '/',
  express.json({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
  })
);
router.post('/', function (req, res, next) {
  // TODO: Most of this could be done inside an Arango query...
  return Promise.try(() => {
    // TODO: Check scope of current token
    let auth = Object.assign(
      {
        // TODO: Which fields should be selectable by the client?
        user: {
          _id: req.user['user_id'],
        },
        clientId: req.user['client_id'],
        createTime: Date.now(),
        expiresIn: 3600,
        // TODO: How to generate token?
        token: uuid(),
      },
      req.body
    );

    // Don't allow making tokens for other users unless admin.user
    if (auth.user['_id'] !== req.user['user_id']) {
      if (
        !_.find(
          req.user.scope,
          (s) => s === 'oada.admin.user:all' || 'oada.admin.user:write'
        )
      ) {
        return Promise.reject(new OADAError('Forbidden', 403));
      }

      // otherwise, token has admin scope so allow it (check user too?)
      info(
        'Posted authorization for a different user, but token has admin.user scope so we are allowing it'
      );
    }

    return authorizations.save(auth);
  })
    .then((result) => {
      if (!result) return null;
      const ret = cloneDeep(result);
      if (ret._rev) delete ret._rev;
      if (ret.user && ret.user._id) ret.user = { _id: ret.user._id };
      res.set('content-location', `/${ret._id}`);
      res.json(ret);
      return res.end();
    })
    .catch(next);
});

// TODO: Should another microservice revoke authorizations?
router.delete('/:authId', function (req, res, next) {
  return authorizations
    .findById(req.params.authId)
    .tap(function chkAuthUser(auth) {
      // Only let users see their own authorizations
      try {
        if (auth.user['_id'] === req.user['user_id']) {
          return Promise.resolve();
        }
      } catch (e) {} // eslint-disable-line no-empty

      return Promise.reject(new OADAError('Forbidden', 403));
    })
    .then(() => authorizations.revoke(req.params.authId))
    .then(() => res.sendStatus(204))
    .catch(next);
});

module.exports = router;
