'use strict';

const Promise = require('bluebird');
const uuid = require('uuid');
const kf = require('kafka-node');
const debug = require('debug')('graph-lookup');
const trace = require('debug')('graph-lookup:trace');
const error = require('debug')('graph-lookup:error');
const info = require('debug')('graph-lookup:info');
const warning = require('debug')('graph-lookup:warning');
const oadaLib = require('../../../libs/oada-lib-arangodb')
const config = require('../config')

const ensureClient = require('../../../libs/oada-lib-kafka').ensureClient;

function start() {
  return Promise.try(() => {
    let topicnames = ['graph_request'];
    trace('starting graph-lookup consumer on topic: graph_request');
    ensureClient('token-lookup', topicnames)
      .catch(err => {
        trace('oada-lib-kafaka not working properly: ' + err);
        return new kf.Client('zookeeper:2181', 'graph-lookup');
      })
      .then(client => {
        var offset = Promise.promisifyAll(new kf.Offset(client));
        var producer = Promise.promisifyAll(new kf.Producer(client, {
          partitionerType: 0
        }));
        var consumer = Promise.promisifyAll(new kf.ConsumerGroup({
          host: 'zookeeper:2181',
          groupId: 'graph-lookup-group',
          fromOffset: 'latest'
        }, ['graph_request']));

        trace('starting graph-lookup producer on topic: http_response')
        producer = producer
          .onAsync('ready')
          .return(producer)
          .tap(function(prod) {
            return prod.createTopicsAsync(['http_response'], true);
          });

        var requests = {};
        consumer.on('message', function(msg) {
          var resp = JSON.parse(msg.value);
          var start = new Date().getTime();
          info(`Performing arango lookup for url ${resp.url}`)
          return oadaLib.resources.lookupFromUrl(resp.url).then((result) => {
            var end = new Date().getTime();
            info(`Finished arango lookup for url ${resp.url} +${end-start}ms`)
            trace(`lookup for url ${resp.url} returned:`, result)
            return producer.then(function sendTokReq(prod) {
              result.connection_id = resp.connection_id;
              return prod.sendAsync([{
                topic: config.get('kafka:topics:httpResponse'),
                messages: JSON.stringify(result)
              }]);
            }).then(() => {
              return offset.commitAsync('graph-lookup-group', [msg]);
            })
          })
        })
      })
  }).then(() => {
    trace('graph-lookup consumer successfully started')
    trace('graph-lookup producer successfully started')
    return true
  }).catch((err) => {
    error(err)
  })
}

module.exports = {
  start
}