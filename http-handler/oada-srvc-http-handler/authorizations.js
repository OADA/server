'use strict';

var Promise = require('bluebird');
const express = require('express');

const authorizations = require('../../libs/oada-lib-arangodb').authorizations;
const OADAError = require('oada-error').OADAError;

var router = express.Router();

// Authorizations routes
// TODO: How the heck should this work??
router.get('/', function(req, res, next) {
    return authorizations.findByUser(req.user.doc['user_id'])
        .reduce((o, i) => {
            let k = i['_id'].replace(/^authorizations\//, '');
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
                    return;
                }
            } catch (e) {}

            return Promise.reject(new OADAError('Not Authorized', 403));
        })
        .then(res.json)
        .catch(next);
});
// TODO: Should another microservice revoke authorizations?
router.delete('/:authId', function(req, res, next) {
    return authorizations.findById(req.params.authId)
        .tap(function chkAuthUser(auth) {
            // Only let users see their own authorizations
            try {
                if (auth.user['_id'] === req.user.doc['user_id']) {
                    return;
                }
            } catch (e) {}

            return Promise.reject(new OADAError('Not Authorized', 403));
        })
        .then(() => oadaLib.authorizations.revoke(req.params.authId))
        .then(() => res.sendStatus(204))
        .catch(next);
});

module.exports = router;
