'use strict'

/*
  Testing script 5:
    - The scenario for multiple GET requests with valid token + valid URL, but
      requesting something out of the scope indicated by the token.
 */

 const config = require('../config');
 // config.set('isTest', true);

 const debug = require('debug');
 const trace = debug('tests:trace');
 const info = debug('tests:info');
 const error = debug('tests:error');
 const debugMark = " => ";

 const expect = require('chai').expect;
 const axios = require('axios');
 const Promise = require('bluebird');
 const validator = require('validator');

 // To test the token lookup, we need a dummy data base. Note that isTest has
 // been set to true in package.json so that oadalib will populate the database
 // according to exmpledocs for us.
 const oadaLib = require('oada-lib-arangodb');
 let setDatabaseP = oadaLib.init.run()
   .catch(err => {
     error(err);
   });

 // Real tests.
 info(debugMark + 'Starting tests... (for securityScope)');
 const VALID_TOKEN_WITH_EMPTY_SCOPE = 'abc';

 const tokenToUse = VALID_TOKEN_WITH_EMPTY_SCOPE;
 const VALID_GET_REQ_URL = '/bookmarks/rocks/rocks-index/90j2klfdjss';
 let url = 'http://proxy' + VALID_GET_REQ_URL;

 describe('GET (Valid Token with Valid URL)', () => {
   //--------------------------------------------------
   // Task - HTTP response
   //--------------------------------------------------
   // Hit the server with a URL (and a token) and check corresponding HTTP
   // response message.
   let http_get_response = null,
     http_get_error_response = null;

   before((done) => {
     // Embed the token for all HTTP request.
     axios.interceptors.request.use(function(config) {
       const token = tokenToUse; // cookie.get(__TOKEN_KEY__);

       if (token != null) {
         config.headers.Authorization = `Bearer ${token}`;
       }

       return config;
     }, function(errEmbedToken) {
       return Promise.reject(errEmbedToken);
     });

     // Hit the server when everything is set up correctly.
     setDatabaseP.then(() => {
       axios.get(url)
         .then(function(response) {
           trace('HTTP GET Response: ' + response);
           http_get_response = response;
           done();
         })
         .catch(function(error) {
           info('HTTP GET Error: ' + error);
           if (error.response) {
             info('data: ', error.response.data);
             info('status: ', error.response.status);
             info('headers: ', error.response.headers);
             http_get_error_response = error.response;
           }
           done();
         });
     });
   });

   // Tests.
   // TODO

   after(() => {
     info(debugMark + "in after()")
     info("    config = " + config);
     info("    config.isTest = " + config.get("isTest"));
     //return oadaLib.init.cleanup();
   });
 });