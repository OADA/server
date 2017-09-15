'use strict';

const debug = require('debug')('graph-lookup');
const trace = require('debug')('graph-lookup:trace');
const error = require('debug')('graph-lookup:error');
const info = require('debug')('graph-lookup:info');
const warning = require('debug')('graph-lookup:warning');
const config = require('./config')
const Responder = require('../../libs/oada-lib-kafka').Responder;
const oadaLib = require('../../libs/oada-lib-arangodb');

const responder = new Responder(
  config.get('kafka:topics:graphRequest'),
  config.get('kafka:topics:httpResponse'),
  config.get('kafka:groupId'));

module.exports = function stopResp() {
  return responder.disconnect();
};


responder.on('request', function handleReq(req, msg) {
  var start = new Date().getTime();
  info(`Performing arango lookup for url ${req.url}`)
  return oadaLib.resources.lookupFromUrl(req.url, req.user_id).then((result) => {
    var end = new Date().getTime();
    info(`Finished arango lookup for url ${req.url} +${end-start}ms`)
    trace(`lookup for url ${req.url} returned:`, result)
    result.connection_id = req.connection_id;
    return result;
  }).catch((err) => {
    error(err)
    return undefined
  })
})
