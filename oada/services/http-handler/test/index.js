'use strict';

/*global step */

var Promise = require('bluebird');
const expect = require('chai').expect;
const request = require('supertest');
var kf;
var app;
var consumer;
var client;
var producer;
var db;

var config = require('../config');

describe('GET /bookmarks/a', function () {
  const token = 'Bearer FOOBAR';
  const user = '123';
  const bookmarks = '123';
  const scope = ['oada.rocks:all'];
  var id;
  var req;
  var res = {
    _meta: {
      _owner: user,
      _type: 'application/vnd.oada.rocks.1+json',
    },
    a: { foo: 'bar' },
    b: 'baz',
  };

  before(function setupKafka() {
    kf = require('kafka-node');
    app = require('../').app;
    db = require('@oada/lib-arangodb');

    consumer = new kf.ConsumerGroup(
      {
        host: config.get('kafka:broker'),
        groupId: 'test',
        fromOffset: 'latest',
      },
      [
        config.get('kafka:topics:tokenRequest'),
        config.get('kafka:topics:graphRequest'),
      ]
    );

    client = new kf.Client(config.get('kafka:broker'), 'http-handler-test');

    producer = Promise.promisifyAll(
      new kf.Producer(client, {
        partitionerType: 0, //kf.Producer.PARTITIONER_TYPES.keyed
      })
    );
    producer = producer.onAsync('ready').return(producer);

    return Promise.fromCallback((done) => consumer.on('connect', done));
  });

  before(function setupDb() {
    return db.resources.setResource('123', '', res);
  });
  ['', 'not'].forEach(function (not) {
    describe('when' + (not ? ' not ' : ' ') + 'owner', function () {
      step('should make token_request', function () {
        var resp = Promise.fromCallback((done) => {
          consumer.on('message', (msg) => {
            done(null, msg);
          });
        });
        req = request(app)
          .get('/bookmarks/a')
          .set('Authorization', token)
          .then((res) => res);

        return resp
          .get('value')
          .then(JSON.parse)
          .then((resp) => {
            id = resp['connection_id'];
            expect(resp.token).to.equal(token);
          });
      });

      step('should resolve bookmarks', function () {
        var resp = Promise.fromCallback((done) => {
          consumer.on('message', (msg) => {
            done(null, msg);
          });
        });
        return producer
          .then(function (prod) {
            return prod.sendAsync([
              {
                topic: config.get('kafka:topics:httpResponse'),
                messages: JSON.stringify({
                  connection_id: id,
                  token: token,
                  token_exists: true,
                  doc: {
                    user_id: not ? user + 'x' : user,
                    bookmarks_id: bookmarks,
                    scope: scope,
                  },
                }),
              },
            ]);
          })
          .then(() => {
            return resp
              .get('value')
              .then(JSON.parse)
              .then((resp) => {
                expect(resp.url).to.match(RegExp('^/resources/' + bookmarks));
              });
          });
      });

      function answerGraphReq() {
        return producer.then(function (prod) {
          return prod.sendAsync([
            {
              topic: config.get('kafka:topics:httpResponse'),
              messages: JSON.stringify({
                connection_id: id,
                token: token,
                url: '/resources/123/a',
                resource_id: '123',
                path_leftover: 'a/',
                meta_id: '456',
              }),
            },
          ]);
        });
      }
      if (not) {
        step('should respond with 403', function () {
          return answerGraphReq()
            .then(() => req)
            .get('status')
            .then(function (status) {
              expect(status).to.equal(403);
            });
        });
      } else {
        step('should respond with document', function () {
          return answerGraphReq()
            .then(() => req)
            .get('body')
            .then(function (doc) {
              expect(doc).to.deep.equal(res['a']);
            });
        });
      }
    });
  });
});
