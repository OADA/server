'use strict'

const Promise = require('bluebird')
const express = require('express')
const bodyParser = require('body-parser')
const debug = require('debug')
const trace = debug('http-handler:trace')
const info = debug('http-handler:info')
const error = debug('http-handler:error')
const ksuid = require('ksuid')
const { OADAError } = require('oada-error')

const config = require('./config')

var requester = require('./requester')

var router = express.Router()

const { users } = require('../../libs/oada-lib-arangodb')

//router.post('/', bodyParser.json({
//    strict: false,
//    type: ['json', '+json'],
//    limit: '20mb',
//}));
router.use(
    bodyParser.json({
        strict: false,
        type: ['json', '+json'],
        limit: '20mb'
    })
)

function requestUserWrite (req, id) {
    // TODO: Sanitize POST body?
    return requester
        .send(
            {
                connection_id: req.id,
                domain: req.get('host'),
                token: req.get('authorization'),
                authorization: req.authorization,
                user: req.body,
                id // need for PUT, ignored for POST
            },
            config.get('kafka:topics:userRequest')
        )
        .tap(function chkSuccess (resp) {
            switch (resp.code) {
                case 'success':
                    return Promise.resolve()
                default:
                    let msg = 'write failed with code ' + resp.code
                    return Promise.reject(new OADAError(msg))
            }
        })
}

router.post('/', function (req, res, next) {
    info('Users POST, body = ', req.body)
    // Note: if the username already exists, the ksuid() below will end up
    // silently discarded and replaced in the response with the real one.
    return requestUserWrite(req, ksuid.randomSync().string)
        .then(resp => {
            // TODO: Better status code choices?
            const id = resp.user['_key']
            return res.redirect(201, req.baseUrl + '/' + id)
        })
        .catch(next)
})

// Update (merge) a user:
router.put('/:id', function (req, res, next) {
    info('Users PUT(id: ', req.id, '), body = ', req.body)
    return requestUserWrite(req, req.params.id)
        .then(resp => {
            // TODO: Better status code choices?
            const id = resp.user['_key']
            return res.redirect(201, req.baseUrl + '/' + id)
        })
        .catch(next)
})

router.get('/me', function (req, res, next) {
    req.url = req.url.replace(
        /^\/me/,
        `/${req.user['user_id'].replace(/^users\//, '')}`
    )
    next()
})

//TODO: don't return stuff to anyone anytime
router.get('/:id', function (req, res) {
    return users.findById(req.params.id).then(response => {
        // Copy and get rid of password field
        // eslint-disable-next-line no-unused-vars
        let { password, ...user } = response
        res.set('Content-Location', '/users/' + req.params.id)
        return res.json(user)
    })
})

module.exports = router
