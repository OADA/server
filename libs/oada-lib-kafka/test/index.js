'use strict';

const Promise = require('bluebird');
const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const kf = require('node-rdkafka');
const uuid = require('uuid');
const info = require('debug')('oada-lib-kafka:tests:info');
const error = require('debug')('oada-lib-kafka:tests:error');

const config = require('../config');

const Responder = require('../').Responder;
const Requester = require('../').Requester;

const REQ_TOPIC = 'test_requests';
const RES_TOPIC = 'test_responses';
const GROUP = 'test_group';

describe('oada-lib-kafka', () => {
    let prod;
    before(function makeTestProd(done) {
        this.timeout(10000);

        prod = new kf.Producer({
            'metadata.broker.list': config.get('kafka:broker')
        });

        prod.on('error', error);
        prod.on('event.error', error);

        prod.connect();

        return prod.on('ready', () => done());
    });
    after(function killTestProd(done) {
        this.timeout(60000);
        prod.disconnect();
        prod.on('disconnected', () => done());
    });

    let cons;
    before(function makeTestCons(done) {
        this.timeout(10000);

        cons = new kf.KafkaConsumer({
            'metadata.broker.list': config.get('kafka:broker'),
            'group.id': GROUP,
            'enable.auto.commit': false,
            'auto.offset.reset': 'latest'
        });

        cons.on('error', error);
        cons.on('event.error', error);

        cons.connect();

        return cons.on('ready', () => {
            done();
        });
    });
    after(function killTestCons(done) {
        this.timeout(10000);
        cons.disconnect();
        cons.on('disconnected', () => done());
    });

    describe('Responder', () => {
        before(function consumerResponses() {
            cons.unsubscribe();
            cons.subscribe([RES_TOPIC]);
            cons.consume();
        });

        let res;
        beforeEach(function createResponder(done) {
            info('start create responder');
            let group = GROUP + '_' + uuid();

            res = new Responder(REQ_TOPIC, RES_TOPIC, group);
            res.on('error', error);
            res.on('ready', () => {
                info('finish create responder');
                done();
            });
        });

        afterEach(function destroyResponder(done) {
            info('start destroy responder');
            res.disconnect().finally(() => {
                info('finish destroy responder');
                done();
            });
        });

        it('should receive a request', () => {
            info('start');
            let obj = {
                'connection_id': uuid(),
                'foo': 'baz',
                'time': Date.now()
            };
            let mesg = new Buffer(JSON.stringify(obj));

            let req = Promise.fromCallback(done => {
                res.on('request', req => {
                    info('request');
                    done(null, req);
                });
            });

            prod.produce(REQ_TOPIC, null, mesg);
            return expect(req).to.eventually.deep.equal(obj);
        });

        it('should not receive timed-out requests', () => {
            info('start');
            let id1 = uuid();
            let id2 = uuid();
            let mesg1 = new Buffer(JSON.stringify({
                'connection_id': id1,
                'time': Date.now() - 365 * 24 * 60 * 60 * 1000 // 1 year ago
            }));
            let mesg2 = new Buffer(JSON.stringify({
                'connection_id': id2,
                'time': Date.now()
            }));

            res.on('ready', () => info('ready'));

            let p = Promise.fromCallback(done => {
                let reqs = [];
                res.on('request', req => {
                    info('request');
                    reqs.push(req);

                    if (req['connection_id'] === id2) {
                        done(null, reqs);
                    }
                });
            }).each(req => {
                // Make sure we didn't recieve the "old" request
                expect(req['connection_id']).to.not.equal(id1);
            });

            prod.produce(REQ_TOPIC, null, mesg1);
            prod.produce(REQ_TOPIC, null, mesg2);
            return p;
        });

        it('should respond to a request', () => {
            info('start');
            let id = 'DEADBEEF';
            let obj = {'foo': 'bar', 'connection_id': id};
            let mesg = new Buffer(JSON.stringify(obj));

            res.on('ready', () => info('ready'));

            let robj = {'a': 'c'};
            res.on('request', req => {
                info('request');
                return Object.assign(req, robj);
            });

            let resp = Promise.fromCallback(done => {
                cons.on('data', data => {
                    info('data');
                    let resp = JSON.parse(data.value);
                    if (resp['connection_id'] === id) {
                        done(null, resp);
                    }
                });
            }).then(resp => {
                delete resp.time;
                return resp;
            });

            prod.produce(REQ_TOPIC, null, mesg);
            return expect(resp).to.eventually
                    .deep.equal(Object.assign(obj, robj));
        });
    });

    describe('Requester', () => {
        before(function consumerRequests() {
            cons.unsubscribe();
            cons.subscribe([REQ_TOPIC]);
            cons.consume();
        });

        let req;
        beforeEach(function createRequester(done) {
            info('start create requester');
            let group = GROUP + '_' + uuid();

            req = new Requester(RES_TOPIC, REQ_TOPIC, group);
            req.on('error', error);
            req.on('ready', () => {
                info('finish create requester');
                done();
            });
        });

        afterEach(function destroyRequester(done) {
            info('start destroy requester');
            req.disconnect().finally(() => {
                info('finish destroy requester');
                done();
            });
        });

        it('should make a request', () => {
            let id = uuid();
            let obj = {'connection_id': id};

            let resp = Promise.fromCallback(done => {
                cons.on('data', data => {
                    info('data');
                    let resp = JSON.parse(data.value);
                    if (resp['connection_id'] === id) {
                        done(null, resp);
                    }
                });
            }).then((resp) => {
                let mesg = new Buffer(JSON.stringify(resp));
                prod.produce(RES_TOPIC, null, mesg);
            });

            req.send(obj).catch(() => {}); // Ignore response
            return resp;
        });

        it('should receive a response', () => {
            let id = uuid();
            let obj = {'connection_id': id};

            let resp = Promise.fromCallback(done => {
                cons.on('data', data => {
                    info('data');
                    let resp = JSON.parse(data.value);
                    if (resp['connection_id'] === id) {
                        done(null, resp);
                    }
                });
            }).then((resp) => {
                let mesg = new Buffer(JSON.stringify(resp));
                prod.produce(RES_TOPIC, null, mesg);
            });

            return Promise.join(req.send(obj), resp);
        });

        it('should timeout when no response', function() {
            this.timeout(10000);
            let id = uuid();
            let obj = {'connection_id': id};

            return expect(req.send(obj))
                    .to.be.rejectedWith(Promise.timeoutError);
        });
    });
});
