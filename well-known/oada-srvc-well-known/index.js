//-----------------------------------------------------------------------
// This service will provide a cohesive "/.well-known/oada-configuration"
// and "/.well-known/openid-configuration" which is built from any 
// global settings merged with the well-known documents of any internal
// microservices.  Each external request to well-known results in 
// internal requests to every internal service to retrieve the
// latest well-known documents.

const debuglib = require('debug');
const Promise = require('bluebird');
const express = require('express');
const express_promise = require('express-promise');
const _ = require('lodash');
const cors = require('cors');
const fs = require('fs');
const well_known_json = require('well-known-json');
const oada_error = require('oada-error');
const config = require('./config');
const request = Promise.promisify(require('request'));

return Promise.try(function() {
  // Setup the loggers:
  const log = { 
    info: debuglib('well-known:info'),
    trace: debuglib('well-known:trace'),
  };

  log.info('-------------------------------------------------------------');
  log.info('Starting server for ./well-known/oada-configuration...');
  log.info('config.get(wellKnown) = ', config.get('wellKnown'));

  // Setup express:
  const app = express();
  // Allow route handlers to return promises:
  app.use(express_promise());


  //-----------------------------------------------------------------
  // Log all requests before anything else gets them for debugging:
  app.use(function(req, res, next) {
    log.info('Received request: ' + req.method + ' ' + req.url);
    //log.trace('req.headers = ', req.headers);
    //log.trace('req.body = ', req.body);
    next();
  });


  //----------------------------------------------------------
  // Turn on CORS for all domains, allow the necessary headers
  app.use(cors({
    exposedHeaders: [ 'x-oada-rev', 'location' ],
  }));
  app.options('*', cors());


  //---------------------------------------------------
  // Configure the top-level OADA well-known handler middleware
  const well_known_handler = well_known_json({
    headers: {
      'content-type': 'application/vnd.oada.oada-configuration.1+json',
    },
  });
  well_known_handler.addResource('oada-configuration', config.get('wellKnown:oada-configuration'));
  well_known_handler.addResource('openid-configuration', config.get('wellKnown:openid-configuration'));


  //---------------------------------------------------------------------------------
  // Retrieve /.well-known/ from sub-services, replacing domains and paths as needed
  app.use(function(req,res,done) {
    // parse out the '/.well-known' part of the URL, like 
    // '/.well-known/oada-configuration' or '/.well-known/openid-configuration'
    const whichdoc = req.url.replace(/^.*(\/.well-known\/.*$)/,'$1'); // /.well-known/oada-configuration
    const resource = whichdoc.replace(/^\/.well-known\/(.*)$/,'$1');  // oada-configuration
    const subservices = config.get('wellKnown:mergeSubServices');
    if (_.isArray(subservices)) {
      return Promise.map(subservices, function(s) {

        // If this subservice doesn't support this resource (oada-configuration vs. openid-configuration), move on...
        if (s.resource  !== resource) {
          log.trace('Requested resource '+resource+', but this subservice entry (',s,') is not for that resource.  Skipping...');
          return;
        } else {
          log.trace('Resource ('+resource+') matches subservice entry (',s,'), retrieving');
        }

        // Request this resource from the subservice:
        const url = s.base+whichdoc;
        log.trace('Requesting subservice url: '+url);
        return request({url:url,json:true})
        .then(function(result) {
          if (!result || result.statusCode !== 200) {
            log.info(whichdoc + ' does not exist for subservice '+s.base);
            return;
          }

          log.info('Merging '+whichdoc+' for subservice '+s.base);
          // the wkj handler library unfortunately puts the servername for the sub-service on the
          // URL's instead of the proxy's name.  Replace the subservice name with "./" so 
          // this top-level wkj handler will replace properly:
          const pfx = s.addPrefix || '';
          const body = _.mapValues(result.body, function(val) {
            if (typeof val !== 'string') return val;
            return val.replace(/^https?:\/\/[^\/]+\//, './'+pfx);
          });
          well_known_handler.addResource(s.resource, body);

        // If failed to return, or json didn't parse:
        }).catch(function(err) {
          log.info('The subservice URL '+url+' failed. err = ', err);
        });

      // No matter whether we throw or not, let request continue:
      }).finally(function() { done(); });
    }
  });

  // Include well_known_handler AFTER the subservices check so that
  // express does the check prior to the well-known handler responding.
  app.use(well_known_handler);


  //--------------------------------------------------
  // Default handler for top-level routes not found:
  app.use(function(req, res){
    throw new oada_error.OADAError('Route not found: ' + req.url, oada_error.codes.NOT_FOUND);
  });

  //---------------------------------------------------
  // Use OADA middleware to catch errors and respond
  app.use(oada_error.middleware(console.log));

  app.set('port', config.get('wellKnown:server:port'));

  //---------------------------------------------------
  // In oada-srvc-docker, the proxy provides the https for us,
  // but this service could also have its own certs and run https
  if(config.get('wellKnown:server:protocol') === 'https://') {
    var s = https.createServer(config.get('wellKnown:server:certs'), app);
    s.listen(app.get('port'), function() {
      log.info('OADA Well-Known service started on port ' 
               + app.get('port')
               + ' [https]');
    });

  //-------------------------------------------------------
  // Otherwise, just plain-old HTTP server
  } else {
    app.listen(app.get('port'), function() {
      log.info('OADA Test Server started on port ' + app.get('port'));
    });
  }
});

