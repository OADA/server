'use strict';

const Promise = require('bluebird');
const expect = require('chai').expect;
const kf = require('node-rdkafka');
const config = require('../config');

const Responder = require('../').Responder;
const Requester = require('../').Requester;

const REQ_TOPIC = 'test_requests';
const RES_TOPIC = 'test_responses';
const GROUP = 'test_group';

describe('Responder', () => {
    let res;
    beforeEach(function createResponder() {
        res = new Responder(REQ_TOPIC, RES_TOPIC, GROUP);
    });

    afterEach(function destroyResponder(done) {
        res.producer.flush(null, () => {
            res.disconnect();
            done();
        });
    });

    let prod;
    before(function makeTestProd(done) {
        //this.timeout(10000);

        prod = new kf.Producer({
            'metadata.broker.list': config.get('kafka:broker')
        });

        prod.connect();

        return prod.on('ready', () => done());
    });
    after(function killTestProd(done) {
        prod.flush(null, () => {
            prod.disconnect();
            done();
        });
    });

    let cons;
    before(function makeTestCons(done) {
        //this.timeout(10000);

        cons = new kf.KafkaConsumer({
            'metadata.broker.list': config.get('kafka:broker'),
            'group.id': GROUP,
            'auto.offset.reset': 'latest'
        });

        cons.connect();

        return cons.on('ready', () => {
            cons.subscribe([RES_TOPIC]);
            cons.consume();
            done()
        });
    });
    after(function killTestCons() {
        cons.disconnect();
    });

    it('should become ready', done => {
        res.on('ready', () => done());
    });

    it('should receive a request', () => {
        let obj = {'foo': 'baz'};
        let mesg = new Buffer(JSON.stringify(obj));

        let p = Promise.fromCallback(done => {
            res.on('request', req => {
                done(null, req);
                return {};
            });
        }).then(req => {
            expect(req).to.deep.equal(obj);
        });

        prod.produce(REQ_TOPIC, null, mesg);
        return p;
    });

    it('should respond to a request', () => {
        let id = 'DEADBEEF';
        let obj = {'foo': 'bar', 'connection_id': id};
        let mesg = new Buffer(JSON.stringify(obj));

        let robj = {'a': 'c'};
        res.on('request', req => {
            return Object.assign(req, robj);
        });

        let p = Promise.fromCallback(done => {
            cons.on('data', data => {
                let resp = JSON.parse(data.value);
                if (resp['connection_id'] === id) {
                    done(null, resp);
                }
            });
        }).then(resp => {
            expect(resp).to.deep.equal(Object.assign(obj, robj));
        });

        prod.produce(REQ_TOPIC, null, mesg);
        return p;
    });
});

describe('Requester', () => {
    xit('should work', () => {
        var req = new Requester();
    })
});
