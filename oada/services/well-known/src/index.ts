/* Copyright 2021 Open Ag Data Alliance
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

//-----------------------------------------------------------------------
// This service will provide a cohesive "/.well-known/oada-configuration"
// and "/.well-known/openid-configuration" which is built from any
// global settings merged with the well-known documents of any internal
// microservices.  Each external request to well-known results in
// internal requests to every internal service to retrieve the
// latest well-known documents.

import https from 'https';

import { middleware as formats } from '@oada/formats-server';
import well_known_json from '@oada/well-known-json';

import config from './config.js';

import axios from 'axios';
import Bluebird from 'bluebird';
import cors from 'cors';
import debuglib from 'debug';
import express from 'express';
import helmet from 'helmet';
import type { ServerOptions } from 'http';
import oada_error from 'oada-error';

function run() {
  // Setup the loggers:
  const log = {
    error: debuglib('well-known:error'),
    info: debuglib('well-known:info'),
    trace: debuglib('well-known:trace'),
  };

  log.info('-------------------------------------------------------------');
  log.info('Starting server for ./well-known/oada-configuration...');
  log.trace('config.get(wellKnown) = %O', config.get('wellKnown'));

  // Setup express:
  const app = express();

  app.use(helmet() as (...args: unknown[]) => void);

  //-----------------------------------------------------------------
  // Log all requests before anything else gets them for debugging:
  app.use(function (req, _res, next) {
    log.info('Received request: %s %s', req.method, req.url);
    //log.trace('req.headers = ', req.headers);
    //log.trace('req.body = ', req.body);
    next();
  });

  //----------------------------------------------------------
  // Turn on CORS for all domains, allow the necessary headers
  app.use(
    cors({
      exposedHeaders: ['x-oada-rev', 'location'],
    })
  );
  app.options('*', cors() as (...args: unknown[]) => void);

  // TODO: Less gross fix for Content-Types?
  app.get('/.well-known/oada-configuration', (_, res, next) => {
    res.type('application/vnd.oada.oada-configuration.1+json');
    next();
  });
  app.get('/.well-known/oada-configuration', formats({}));

  //---------------------------------------------------
  // Configure the top-level OADA well-known handler middleware
  const options: { forceProtocol?: string } = {};
  if (config.get('wellKnown.forceProtocol')) {
    // set to 'https' to force to https.  Useful when behind another proxy.
    options.forceProtocol = config.get('wellKnown.forceProtocol') || undefined;
  }
  const well_known_handler = well_known_json(options);
  well_known_handler.addResource(
    'oada-configuration',
    config.get('wellKnown.oada-configuration')
  );
  well_known_handler.addResource(
    'openid-configuration',
    config.get('wellKnown.openid-configuration')
  );

  //------------------------------------------
  // Retrieve /.well-known/ from sub-services,
  // replacing domains and paths as needed
  app.use(function (req, _res, done) {
    // parse out the '/.well-known' part of the URL, like
    // '/.well-known/oada-configuration' or '/.well-known/openid-configuration'
    //
    // /.well-known/oada-configuration
    const whichdoc = req.url.replace(/^.*(\/.well-known\/.*$)/, '$1');
    // oada-configuration
    const resource = whichdoc.replace(/^\/.well-known\/(.*)$/, '$1');
    const subservices = config.get('wellKnown.mergeSubServices');
    if (Array.isArray(subservices)) {
      return Bluebird.map(subservices, function (s) {
        // If this subservice doesn't support this resource
        // (oada-configuration vs. openid-configuration), move on...
        if (s.resource !== resource) {
          log.trace(
            'Requested resource %s, ' +
              'but this subservice entry (%o) is not for that resource.' +
              'Skipping...',
            resource,
            s
          );
          return;
        } else {
          log.trace(
            'Resource (%s) matches subservice entry (%o), retrieving',
            resource,
            s
          );
        }

        // Request this resource from the subservice:
        const url = s.base + whichdoc;
        log.trace('Requesting subservice URL: %s', url);
        return axios
          .get(url)
          .then(function (result) {
            if (result?.status !== 200) {
              log.trace(
                '%s does not exist for subservice %s',
                whichdoc,
                s.base
              );
              return;
            }

            log.trace('Merging %s for subservice %s', whichdoc, s.base);
            // the wkj handler library puts the servername for the sub-service
            // on the URLs instead of the proxy's name.
            // Replace the subservice name with "./"
            // so this top-level wkj handler will replace properly:
            const pfx = s.addPrefix || '';
            const body: Record<string, unknown> = {};
            for (const [key, val] of Object.entries(result.data)) {
              if (typeof val !== 'string') {
                body[key] = val;
              } else {
                body[key] = val.replace(/^https?:\/\/[^/]+\//, './' + pfx);
              }
            }
            well_known_handler.addResource(s.resource, body);
            log.trace('Merged into %s: %O', whichdoc, body);

            // If failed to return, or json didn't parse:
          })
          .catch(function (err) {
            log.error('The subservice URL %s failed. err = %O', url, err);
          });

        // No matter whether we throw or not, let request continue:
      }).finally(function () {
        done();
      });
    }
  });

  // Include well_known_handler AFTER the subservices check so that
  // express does the check prior to the well-known handler responding.
  app.use(well_known_handler);

  //--------------------------------------------------
  // Default handler for top-level routes not found:
  app.use(function (req) {
    throw new oada_error.OADAError(
      'Route not found: ' + req.url,
      oada_error.codes.NOT_FOUND
    );
  });

  //---------------------------------------------------
  // Use OADA middleware to catch errors and respond
  app.use(oada_error.middleware(log.error));

  app.set('port', config.get('wellKnown.server.port'));

  //---------------------------------------------------
  // In oada/server, the proxy provides the https for us,
  // but this service could also have its own certs and run https
  if (config.get('wellKnown.server.mode') === 'https') {
    const s = https.createServer(
      config.get('wellKnown.server.certs') as ServerOptions,
      app
    );
    s.listen(app.get('port'), function () {
      log.info(
        'OADA Well-Known service started on port %d [https]',
        app.get('port')
      );
    });

    //-------------------------------------------------------
    // Otherwise, just plain-old HTTP server
  } else {
    app.listen(app.get('port'), function () {
      log.info('OADA well-known server started on port %d', app.get('port'));
    });
  }
}

void run();
