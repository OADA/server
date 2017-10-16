'use strict';

const Promise = require('bluebird');
const express = require('express');
const uuid = require('uuid');

const debug = require('debug-logger')('http-handler#authorizations');
const trace = debug.trace;

const {authorizations, clients} = require('../../libs/oada-lib-arangodb');
const {OADAError} = require('oada-error');

var router = express.Router(); // eslint-disable-line new-cap

function addClientToAuth(auth) {
  if (auth && auth.clientId) {
    trace('GET /'+auth._id+': authorization has a client, retrieving');
    return clients.findById(auth.clientId)
    .then(client => {
      auth.client = client; // store client from db into authorization object
      return auth;
    }).catch(err => {
      debug.error('ERROR: authorization clientId not found in DB');
      throw err;
    });
  } else {
    trace('GET /'+auth._id+': authorization DOES NOT have a clientId');
    return auth;
  }
}

// Authorizations routes
// TODO: How the heck should this work??
router.get('/', function(req, res, next) {
    return authorizations.findByUser(req.user.doc['user_id'])
        .reduce((o, i) => {
            let k = i['_id'].replace(/^authorizations\//, '');
            i = addClientToAuth(i); // returns either a promise or the same auth object
            o[k] = i;
            return o;
        }, {})
        .then(res.json)
        .catch(next);
});

router.get('/:authId', function(req, res, next) {
    return authorizations.findById(req.params.authId)
        .tap(function chkAuthUser(auth) {
            // Only let users see their own authorizations
            try {
                if (auth.user['_id'] === req.user.doc['user_id']) {
                    return Promise.resolve();
                }
            } catch (e) {} // eslint-disable-line no-empty

            return Promise.reject(new OADAError('Not Authorized', 403));

        // Get the full client out of the DB to send out with this auth document
        // That way anybody listing authorizations can print the name, etc. of the client
        }).then(addClientToAuth)
        .then(res.json)
        .catch(next);
});

router.post('/', express.json({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
}));
router.post('/', function(req, res, next) {
    // TODO: Most of this could be done inside an Arango query...
    return Promise.try(() => {
        // TODO: Check scope of current token
        let auth = Object.assign({
            // TODO: Which fields should be selectable by the client?
            user: {
                _id: req.user.doc['user_id']
            },
            clientId: req.user.doc['client_id'],
            createTime: Date.now(),
            expiresIn: 3600,
            // TODO: How to generate token?
            token: uuid()
        }, req.body);

        // Don't allow making tokens for other users
        if (auth.user['_id'] !== req.user.doc['user_id']) {
            return Promise.reject(new OADAError('Not Authorized', 403));
        }

        return authorizations.save(auth);
    }).catch(next);
});

// TODO: Should another microservice revoke authorizations?
router.delete('/:authId', function(req, res, next) {
    return authorizations.findById(req.params.authId)
        .tap(function chkAuthUser(auth) {
            // Only let users see their own authorizations
            try {
                if (auth.user['_id'] === req.user.doc['user_id']) {
                    return Promise.resolve();
                }
            } catch (e) {} // eslint-disable-line no-empty

            return Promise.reject(new OADAError('Not Authorized', 403));
        })
        .then(() => authorizations.revoke(req.params.authId))
        .then(() => res.sendStatus(204))
        .catch(next);
});

module.exports = router;
