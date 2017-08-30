'use strict';

var Promise = require('bluebird');
const express = require('express');
const bodyParser = require('body-parser');

const OADAError = require('oada-error').OADAError;

const config = require('./config');

var requester = require('./requester');

var router = express.Router();

router.post('/', bodyParser.json({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
}));

router.post('/', function(req, res, next) {
    // TODO: Sanitize POST body?
    return requester.send({
        'connection_id': req.id,
        'token': req.get('authorization'),
        'user': req.body
    }, config.get('kafka:topics:userRequest'))
    .tap(function chkSuccess(resp) {
        switch (resp.code) {
            case 'success':
                return;
            default:
                let msg = 'write failed with code ' + resp.code;
                return Promise.reject(new OADAError(msg));
        }
    })
    .then(resp => {
        // TODO: Better status code choices?
        let id = resp.user._key;
        return res.redirect(resp.new ? 201 : 303, req.baseUrl + '/' + id);
    })
    .catch(next);
});

module.exports = router;
