'use strict';

var Promise = require('bluebird');
const express = require('express');
const bodyParser = require('body-parser');
const trace = require('debug')('http-handler:trace')
const OADAError = require('oada-error').OADAError;

const config = require('./config');

var requester = require('./requester');

var router = express.Router();

var _ = require('lodash')

	/*
router.get('/something', function getWebsockets(req, res) {
    trace('Hello World1')
    if (req.get('Connection') === 'Upgrade' && req.get('Upgrade') === 'websocket') {
        trace('Hello World')
    }
	//		res.sendStatus(101)
    res.end();
});
*/


module.exports = router;
