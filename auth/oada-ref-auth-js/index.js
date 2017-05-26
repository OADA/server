/* Copyright 2014 Open Ag Data Alliance
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

// The config needs to know whether to look for command-line arguments or not,
// so set isLibrary in global scope before requiring.
global.isLibrary = !(require.main === module);

var _ = require('lodash');
var trace = require('debug')('auth#index:trace');
var config = require('./config');
// If there is an endpointsPrefix, update all the endpoints to include the
// prefix before doing anything else
const pfx = config.get('auth:endpointsPrefix');
if (typeof pfx === 'string') {
  trace('Adding supplied prefix '+pfx+' to all endpoints');
  const endpoints = config.get('auth:endpoints');
  _.mapValues(endpoints, (v,k) => {
    config.set('auth:endpoints:'+k, pfx+v);
  });
}
trace('Using config = ', config.get('auth'));

var path = require('path');
var https = require('https');
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var passport = require('passport');
var morgan = require('morgan');
var oauth2orize = require('oauth2orize');
var URI = require('URIjs');

var oadaError = require('oada-error').middleware;
var oadaLookup = require('oada-lookup');


module.exports = function(conf) {
  // TODO: This require config is very hacky. Reconsider.
  if (conf) {
    config.setObject(conf);
  }

  config.set('auth:server:port', process.env.PORT || config.get('auth:server:port'));

  var publicUri;
  if(!config.get('auth:server:publicUri')) {
    publicUri = URI()
      .hostname(config.get('auth:server:domain'))
      .port(config.get('auth:server:port'))
      .protocol(config.get('auth:server:mode'))
      .normalize()
      .toString();
  } else {
    publicUri = URI(config.get('auth:server:publicUri'))
      .normalize()
      .toString();
  }

  config.set('auth:server:publicUri', publicUri);

  // Require these late because they depend on the config
  var dynReg = require('./dynReg');
  var clients = require('./db/models/client');
  var keys = require('./keys');
  var utils = require('./utils');
  require('./auth');
  var app = express();

  var wkj = config.get('auth:wkj') ? config.get('auth:wkj') : require('well-known-json')();

  app.set('view engine', 'ejs');
  app.set('json spaces', config.get('auth:server:jsonSpaces'));
  app.set('views', path.join(__dirname, 'views'));

  app.use(morgan('combined'));
  app.use(cookieParser());
  app.use(bodyParser.urlencoded({extended: true}));
  app.use(session({
    secret: config.get('auth:server:sessionSecret'),
    resave: false,
    saveUninitialized: false
  }));
  app.use(passport.initialize());
  app.use(passport.session());

  var server = oauth2orize.createServer();
  server.serializeClient(function(client, done) {
    return done(null, client.clientId);
  });
  server.deserializeClient(function(id, done) {
    clients.findById(id, done);
  });

  //////
  // UI
  //////
  if (config.get('auth:oauth2:enable') || config.get('auth:oidc:enable')) {
    var oauth2 = require('./oauth2')(server,config);

    app.options(config.get('auth:endpoints:register'), require('cors')());
    app.post(config.get('auth:endpoints:register'),
        require('cors')(), bodyParser.json(), dynReg);

    app.get(config.get('auth:endpoints:authorize'), function(req, res, done) {
      trace('GET '+config.get('auth:endpoints:authorize')+': setting X-Frame-Options=SAMEORIGIN before oauth2.authorize');
      res.header('X-Frame-Options', 'SAMEORIGIN');
      return done();
    }, oauth2.authorize);
    app.post(config.get('auth:endpoints:decision'), oauth2.decision);
    app.post(config.get('auth:endpoints:token'), oauth2.token);

    app.get(config.get('auth:endpoints:login'), function(req, res) {
      trace('GET '+config.get('auth:endpoints:login')+': setting X-Frame-Options=SAMEORIGIN before rendering login');
      res.header('X-Frame-Options', 'SAMEORIGIN');
      res.render('login', {
        hint: config.get('auth:hint'),
        logo_url: config.get('auth:endpointsPrefix')+'/oada-logo.png',
        login_url: config.get('auth:endpoints:login'),
      });
    });

    const pfx = config.get('auth:endpointsPrefix') || '';
    app.post(config.get('auth:endpoints:login'), passport.authenticate('local', {
      successReturnToOrRedirect: '/' + pfx,
      failureRedirect: config.get('auth:endpoints:login'),
    }));

    app.get(config.get('auth:endpoints:logout'), function(req, res) {
      req.logout();
      res.redirect(req.get('Referrer'));
    });

    if (config.get('auth:endpointsPrefix'))
      app.use(config.get('auth:endpointsPrefix'), express.static(path.join(__dirname, 'public')));
    else
      app.use(express.static(path.join(__dirname, 'public')));
  }

  //////
  // OAuth 2.0
  //////
  if (config.get('auth:oauth2:enable')) {
    wkj.addResource('oada-configuration', {
      'authorization_endpoint': './' + config.get('auth:endpoints:authorize'),
      'token_endpoint': './' + config.get('auth:endpoints:token'),
      'registration_endpoint': './' + config.get('auth:endpoints:register'),
      'token_endpoint_auth_signing_alg_values_supported': [
        'RS256',
      ],
    });
  }

  //////
  // OIDC
  //////
  if (config.get('auth:oidc:enable')) {
    require('./oidc')(server);

    app.options(config.get('auth:endpoints:certs'), require('cors')());
    app.get(config.get('auth:endpoints:certs'), require('cors')(), function(req, res) {
      res.json(keys.jwks);
    });

    app.options(config.get('auth:endpoints:userinfo'), require('cors')());
    app.get(config.get('auth:endpoints:userinfo'), require('cors')(),
        passport.authenticate('bearer', {session:false}),
        function(req, res) {

      var userinfo = utils.createUserinfo(req.user, req.authInfo.scope);

      if (userinfo && userinfo.sub !== undefined) {
        res.json(userinfo);
      } else {
        res.status(401).end('Unauthorized');
      }
    });

    wkj.addResource('openid-configuration', {
      'issuer': config.get('auth:server:publicUri'),
      'registration_endpoint': './' + config.get('auth:endpoints:register'),
      'authorization_endpoint': './' + config.get('auth:endpoints:authorize'),
      'token_endpoint': './' + config.get('auth:endpoints:token'),
      'userinfo_endpoint': './' + config.get('auth:endpoints:userinfo'),
      'jwks_uri': './' + config.get('auth:endpoints:certs'),
      'response_types_supported': [
        'code',
        'token',
        'id_token',
        'code token',
        'code id_token',
        'id_token token',
        'code id_token token'
      ],
      'subject_types_supported': [
        'public'
      ],
      'id_token_signing_alg_values_supported': [
        'RS256'
      ],
      'token_endpoint_auth_methods_supported': [
        'client_secret_post'
      ]
    });
  }




  /////
  // .well-known
  /////
  if (!config.get('auth:wkj')) {
    app.use(wkj);
  }

  /////
  // Standard OADA Error
  /////
  app.use(oadaError());

  return app;
}

if (require.main === module) {
  var app = module.exports();
  var server;
  if (config.get('auth:server:mode') === 'http') {
    var server = app.listen(config.get('auth:server:port'), function() {
      console.log('Listening HTTP on port %d', server.address().port);
    });
  } else {
    var server = https.createServer(config.get('auth:certs'), app);
    server.listen(config.get('auth:server:port'), function() {
      console.log('Listening HTTPS on port %d', server.address().port);
    });
  }
}
