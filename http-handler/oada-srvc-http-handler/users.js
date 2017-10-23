'use strict';

const Promise = require('bluebird');
const express = require('express');
const bodyParser = require('body-parser');
const trace = require('debug')('http-handler:trace');
const {OADAError} = require('oada-error');

const config = require('./config');

var requester = require('./requester');

var router = express.Router();

const {users} = require('../../libs/oada-lib-arangodb');

router.post('/', bodyParser.json({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
}));

router.post('/', function(req, res, next) {
    // TODO: Sanitize POST body?
    return requester.send({
        'connection_id': req.id,
        'domain': req.get('host'),
        'token': req.get('authorization'),
        'user': req.body
    }, config.get('kafka:topics:userRequest'))
    .tap(function chkSuccess(resp) {
        switch (resp.code) {
            case 'success':
                return Promise.resolve();
            default:
                let msg = 'write failed with code ' + resp.code;
                return Promise.reject(new OADAError(msg));
        }
    })
    .then(resp => {
        // TODO: Better status code choices?
        let id = resp.user['_key'];
        return res.redirect(201, req.baseUrl + '/' + id);
    })
    .catch(next);
});

router.get('/me', function(req, res, next) {
    req.url = req.url.replace(/^\/me/,
            `/${req.user.doc['user_id'].replace(/^users\//, '')}`);
    next();
});

//TODO: don't return stuff to anyone anytime
router.get('/:id', function(req, res) {
    return users.findById(req.params.id).then((response) => {
        // Copy and get rid of password field
        // eslint-disable-next-line no-unused-vars
        let {password, ...user} = response;
        return res.json(user);
    });
});

module.exports = router;