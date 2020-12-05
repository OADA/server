'use strict';
const moment = require('moment');
const _ = require('lodash');
const expect = require('chai').expect;
const Promise = require('bluebird');
const debug = require('debug');
const kf = require('kafka-node');
const config = require('../config');
config.set('isTest', true);
const oadaLib = require('@oada/lib-arangodb');
const graphLookupService = require('../server');

// Tests for the arangodb driver:

let rockUrl =
  '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss';
let rockResourceId = 'default:resources_rock_123';
let rockMetaId = 'default:meta_rock_123';
let rockPathLeft = '';

let rocksIndexUrl =
  '/resources/default:resources_bookmarks_123/rocks/rocks-index';
let rocksIndexResourceId = 'default:resources_rocks_123';
let rocksIndexMetaId = 'default:meta_rocks_123';
let rocksIndexPathLeft = '/rocks-index';

let rockPickedUrl =
  '/resources/default:resources_bookmarks_123/rocks/rocks-index/90j2klfdjss/picked_up';
let rockPickedPathLeft = '/picked_up';

let producer;
let consumer;

let prodTopic = config.get('kafka:testProducerTopic');
let consTopic = config.get('kafka:testConsumerTopic');

describe('graph-lookup service', () => {
  before(() => {
    // Create the test database (with necessary collections and dummy data)
    return oadaLib.init
      .run()
      .then(() => graphLookupService.start())
      .then(() => {
        let client = Promise.promisifyAll(
          new kf.Client('zookeeper:2181', 'graph-lookup')
        );
        let offset = Promise.promisifyAll(new kf.Offset(client));

        // Create a dummy consumer of http-response messages
        let consOptions = { autoCommit: true };
        consumer = Promise.promisifyAll(
          new kf.Consumer(client, [{ topic: consTopic }], consOptions)
        );

        // Create a dummy producer of graph-request messages
        producer = Promise.promisifyAll(
          new kf.Producer(client, {
            partitionerType: 0,
          })
        );
        return (producer = producer
          .onAsync('ready')
          .return(producer)
          .tap(function (prod) {
            return prod.createTopicsAsync(['graph_request'], true);
          }));
      })
      .catch((err) => {
        console.log(
          'FAILED to initialize graph-lookup tests by creating database '
        );
        console.log('The error = ', err);
      });
  });

  //--------------------------------------------------
  // The tests!
  //--------------------------------------------------

  it('should consume messages on the graph-request topic', (done) => {
    producer
      .then((prod) => {
        return prod
          .sendAsync([
            {
              topic: 'graph_request',
              messages: JSON.stringify({ url: rockUrl }),
            },
          ])
          .then(() => {
            consumer.on('message', (msg) => {
              var result = JSON.parse(msg.value);
              expect(result.resource_id).to.equal(rockResourceId);
              expect(result.meta_id).to.equal(rockMetaId);
              expect(result.path_left).to.equal(rockPathLeft);
              done();
            });
          });
      })
      .catch(done);
  });
  //-------------------------------------------------------
  // After tests are done, get rid of our temp database
  //-------------------------------------------------------
  after(() => {
    return oadaLib.init
      .cleanup()
      .then(() => {
        console.log('Successfully cleaned up test database');
      })
      .catch((err) =>
        console.log('Could not drop test database after the tests! err = ', err)
      );
  });
});
