/**
 * @license
 * Copyright 2017-2021 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

/* global step */

const Promise = require('bluebird');
const { expect } = require('chai');
const request = require('supertest');
let kf;
let app;
let consumer;
let client;
let producer;
let database;

const config = require('../config');

describe('GET /bookmarks/a', () => {
  const token = 'Bearer FOOBAR';
  const user = '123';
  const bookmarks = '123';
  const scope = ['oada.rocks:all'];
  let id;
  let request_;
  const res = {
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
    database = require('@oada/lib-arangodb');

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
        partitionerType: 0, // Kf.Producer.PARTITIONER_TYPES.keyed
      })
    );
    producer = producer.onAsync('ready').return(producer);

    return Promise.fromCallback((done) => consumer.on('connect', done));
  });

  before(function setupDatabase() {
    return database.resources.setResource('123', '', res);
  });
  for (const not of ['', 'not']) {
    describe(`when${not ? ' not ' : ' '}owner`, () => {
      step('should make token_request', () => {
        const resp = Promise.fromCallback((done) => {
          consumer.on('message', (message) => {
            done(null, message);
          });
        });
        request_ = request(app)
          .get('/bookmarks/a')
          .set('Authorization', token)
          .then((res) => res);

        return resp
          .get('value')
          .then(JSON.parse)
          .then((resp) => {
            id = resp.connection_id;
            expect(resp.token).to.equal(token);
          });
      });

      step('should resolve bookmarks', () => {
        const resp = Promise.fromCallback((done) => {
          consumer.on('message', (message) => {
            done(null, message);
          });
        });
        return producer
          .then((production) =>
            production.sendAsync([
              {
                topic: config.get('kafka:topics:httpResponse'),
                messages: JSON.stringify({
                  connection_id: id,
                  token,
                  token_exists: true,
                  doc: {
                    user_id: not ? `${user}x` : user,
                    bookmarks_id: bookmarks,
                    scope,
                  },
                }),
              },
            ])
          )
          .then(() =>
            resp
              .get('value')
              .then(JSON.parse)
              .then((resp) => {
                expect(resp.url).to.match(
                  new RegExp(`^/resources/${bookmarks}`)
                );
              })
          );
      });

      function answerGraphRequest() {
        return producer.then((production) =>
          production.sendAsync([
            {
              topic: config.get('kafka:topics:httpResponse'),
              messages: JSON.stringify({
                connection_id: id,
                token,
                url: '/resources/123/a',
                resource_id: '123',
                path_leftover: 'a/',
                meta_id: '456',
              }),
            },
          ])
        );
      }

      if (not) {
        step('should respond with 403', () =>
          answerGraphRequest()
            .then(() => request_)
            .get('status')
            .then((status) => {
              expect(status).to.equal(403);
            })
        );
      } else {
        step('should respond with document', () =>
          answerGraphRequest()
            .then(() => request_)
            .get('body')
            .then((document) => {
              expect(document).to.deep.equal(res.a);
            })
        );
      }
    });
  }
});
