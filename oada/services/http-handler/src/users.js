'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const ksuid = require('ksuid');
const cloneDeep = require('clone-deep');
const { OADAError } = require('oada-error');

const { default: config } = require('./config');

const requester = require('./requester');

const router = express.Router();

const { users } = require('@oada/lib-arangodb');

function sanitizeDbResult(user) {
  if (!user) return null;
  const u = cloneDeep(user);
  if (u._rev) delete u._rev;
  if (u.password) delete u.password;
  return u;
}

//router.post('/', bodyParser.json({
//    strict: false,
//    type: ['json', '+json'],
//    limit: '20mb',
//}));
router.use(
  bodyParser.json({
    strict: false,
    type: ['json', '+json'],
    limit: '20mb',
  })
);

function requestUserWrite(req, id) {
  // TODO: Sanitize POST body?
  return requester
    .send(
      {
        connection_id: req.id,
        domain: req.get('host'),
        token: req.get('authorization'),
        authorization: req.authorization,
        user: req.body,
        userid: id, // need for PUT, ignored for POST
      },
      config.get('kafka.topics.userRequest')
    )
    .tap(function chkSuccess(resp) {
      switch (resp.code) {
        case 'success':
          return Promise.resolve();
        default:
          let msg = 'write failed with code ' + resp.code;
          return Promise.reject(new OADAError(msg));
      }
    });
}

router.post('/', function (req, res) {
  req.log.info('Users POST, body = %O', req.body);
  // Note: if the username already exists, the ksuid() below will end up
  // silently discarded and replaced in the response with the real one.
  const newid = ksuid.randomSync().string; // generate a random string for ID
  // generate an ID for this particular request
  if (!req.id) req.id = ksuid.randomSync().string;
  return requestUserWrite(req, newid).then((resp) => {
    // TODO: Better status code choices?
    // if db didn't send back a user, it was an update so use id from URL
    const id = resp && resp.user ? resp.user['_key'] : newid;
    // return res.redirect(201, req.baseUrl + '/' + id)
    res.set('content-location', req.baseUrl + '/' + id);
    return res.status(200).end();
  });
});

// Update (merge) a user:
router.put('/:id', function (req, res) {
  req.log.info('Users PUT(id: ' + req.params.id + '), body = %O', req.body);
  // generate an ID for this particular request
  if (!req.id) req.id = ksuid.randomSync().string;
  return requestUserWrite(req, req.params.id).then((resp) => {
    // TODO: Better status code choices?
    // if db didn't send back a user, it was an update so use id from URL
    const id = resp && resp.user ? resp.user['_key'] : req.params.id;
    // return res.redirect(201, req.baseUrl + '/' + id)
    res.set('content-location', req.baseUrl + '/' + id);
    return res.status(200).end();
  });
});

// Lookup a username, limited to tokens and users with oada.admin.user scope
router.get('/username-index/:uname', function (req, res) {
  // Check token scope
  req.log.trace(
    'username-index: Checking token scope, req.authorization.scope = %s',
    req.authorization ? req.authorization.scope : null
  );
  const havetokenscope = req.authorization.scope.find(
    (s) => s === 'oada.admin.user:read' || s === 'oada.admin.user:all'
  );
  if (!havetokenscope) {
    req.log.warn(
      'WARNING: attempt to lookup user by username (username-index), but token does not have oada.admin.user:read or oada.admin.user:all scope!'
    );
    throw new OADAError(
      'Token does not have required oada.admin.user scope',
      401
    );
  }

  // Check user's scope
  req.log.trace('username-index: Checking user scope, req.user = %O', req.user);
  const haveuserscope =
    Array.isArray(req.user.scope) &&
    req.user.scope.find(
      (s) => s === 'oada.admin.user:read' || s === 'oada.admin.user:all'
    );
  if (!haveuserscope) {
    req.log.warn(
      'WARNING: attempt to lookup user by username (username-index), but USER does not have oada.admin.user:read or oada.admin.user:all scope!'
    );
    throw new OADAError(
      'USER does not have required oada.admin.user scope',
      403
    );
  }

  return users
    .findByUsername(req.params.uname)
    .then((u) => {
      u = sanitizeDbResult(u);
      if (!u) {
        req.log.info(
          `#username-index: 404: username ${req.params.uname} does not exist`
        );
        res
          .status(404)
          .send('Username ' + req.params.uname + ' does not exist.');
        return res.end();
      }
      req.log.info(
        `#username-index: found user, returning info for userid ${u._id}`
      );
      res
        .set('content-location', `/${u._id}`)
        .set('content-type', 'application/vnd.oada.user.1+json')
        .status(200)
        .json(u);
      return res.end();
    })
    .catch((e) => {
      req.log.error(
        'FAILED to find user in DB for username-index, username = ' +
          req.params.uname +
          '.  Error was: %O',
        e
      );
      res.status(500).send('Internal Error: ', e.toString());
      return res.end();
    });
});

router.get('/me', function (req, res, next) {
  req.url = req.url.replace(
    /^\/me/,
    `/${req.user['user_id'].replace(/^users\//, '')}`
  );
  next();
});

//TODO: don't return stuff to anyone anytime
router.get('/:id', function (req, res) {
  return users.findById(req.params.id).then((response) => {
    // Copy and get rid of password field
    // eslint-disable-next-line no-unused-vars
    let user = cloneDeep(response);
    if (!user) {
      return res.status(404).end();
    }
    if (user.password) delete user.password;
    // let { password, ...user } = response // doesn't work if no password comes back
    res.set('Content-Location', '/users/' + req.params.id);
    return res.json(user);
  });
});

module.exports = router;
