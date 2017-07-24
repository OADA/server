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


responder.on('request', function handleReq(resp, msg) {
  var start = new Date().getTime();
  info(`Performing arango lookup for url ${resp.url}`)
  return oadaLib.resources.lookupFromUrl(resp.url).then((result) => {
    var end = new Date().getTime();
    info(`Finished arango lookup for url ${resp.url} +${end-start}ms`)
    trace(`lookup for url ${resp.url} returned:`, result)
    result.connection_id = resp.connection_id;
    return result;
  }).catch((err) => {
    error(err)
    return undefined
  })
})
