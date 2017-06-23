'use strict';

const kf = require('node-rdkafka');
const config = require('./config');
const Promise = require('bluebird');
const uuid = require('uuid');

const REQ_ID_KEY = 'connection_id';

function Responder(listenTopic, respTopic, groupId) {
	this.listenTopic = listenTopic;
	this.respTopic = respTopic;
	this.consumer = new kf.KafkaConsumer({
		// 'debug': config.get('debug'),
		'metadata.broker.list': config.get('kafka:broker'),
		'group.id': groupId,
		'enable.auto.commit': config.get('kafka:auto_commit'),
		'auto.offset.reset': config.get('kafka:auto_offset_reset')
	});
	this.producer = new kf.Producer({
		// 'debug': config.get('debug'),
		'metadata.broker.list': config.get('kafka:broker'),
		'dr_cb': true  //delivery report callback
	});
	let consumerReady = Promise.fromCallback(done => {
            this.consumer.on('ready', () => {
                done();
            })
        })
		.then(() => {
			this.consumer.subscribe([listenTopic]);
			this.consumer.consume();
		});
	let producerReady = Promise.fromCallback(done => {
		this.producer.on('ready', () => {
			done();
        })
    });
	this.ready = Promise.join(consumerReady, producerReady);
	this.consumer.connect();
	this.producer.connect();
}

Responder.prototype.disconnect = function disconnect() {
    this.consumer.disconnect();
    this.producer.disconnect();
}

Responder.prototype.on = function on(event, callback) {
	switch(event) {
		case 'request':
			this.consumer.on('data', (data) => {
				let req = JSON.parse(data.value);
                let id = req[REQ_ID_KEY];
                let part = req['resp_partition'];
                if (typeof part !== 'number') {
                    part = null;
                }

				let resp = callback(req);
				this.ready.return(resp)
					.then(resp => {
						if (!Array.isArray(resp)) {
							return [resp];
						}
						return resp;
					})
					.map(resp => {
                        resp[REQ_ID_KEY] = id;
						let payload = JSON.stringify(resp);
						let value = new Buffer(payload);
						this.producer.produce(this.respTopic, part, value);
					})
					.finally(() =>{
                        // TODO: Handle committing better
                        this.consumer.commit(data);
					});
			});
			break;
		case 'ready':
			this.ready.then(callback);
			break;
		default:
			console.log('oada-lib-kafka: unsupported event');
			break;
	};
};

function Requester(listenTopic, respTopic, groupId) {
	this.listenTopic = listenTopic;
	this.respTopic = respTopic;
	this.consumer = new kf.KafkaConsumer({
		'debug': config.get('debug'),
		'metadata.broker.list': config.get('kafka:broker'),
		'group.id': groupId,
		'enable.auto.commit': config.get('kafka:auto_commit'),
		'auto.offset.reset': config.get('kafka:auto_offset_reset')
	});
	this.producer = new kf.Producer({
		'debug': config.get('debug'),
		'metadata.broker.list': config.get('kafka:broker'),
		'dr_cb': true  //delivery report callback
	});
	let consumerReady = Promise.fromCallback(done => {
		    this.consumer.on('ready', () => {
			    done();
		    })
        })
		.then(() => {
			this.consumer.subscribe([listenTopic]);
			this.consumer.consume();
		});
	let producerReady = Promise.fromCallback(done => {
        this.producer.on('ready', () => {
            done();
        })
    });
	this.ready = Promise.join(consumerReady, producerReady);
	this.consumer.connect();
	this.producer.connect();

    this.requests = {};
    this.consumer.on('data', msg => {
        let resp = JSON.parse(msg.value);

        let done = this.requests[resp[REQ_ID_KEY]];

        return done && done(null, resp);
    });

    this .timeout = config.get('kafka:timeouts:default');
    let topics = config.get('kafka:topics');
    Object.keys(topics).forEach(topic => {
        if (topics[topic] === this.respTopic) {
            this.timeout = config.get('kafka:timeouts:' + topic);
        }
    });
}

Requester.prototype.disconnect = function disconnect() {
    this.consumer.disconnect();
    this.producer.disconnect();
}

Requester.prototype.on = function on(event, callback) {
	switch(event) {
		case 'response':
			this.consumer.on('data', (data) => {
				let resp = callback(JSON.parse(data.value));
				this.ready.return(resp)
				.finally(() =>{
					this.consumer.commit(data);
				});
			});
			break;
		case 'ready':
			this.ready.then(callback);
			break;
		default:
			console.log('oada-lib-kafka: unsupported event');
			break;
	};
};

Requester.prototype.send = function send(request) {
    let id = request[REQ_ID_KEY] || uuid();

    // TODO: Handle partitions?
    request['resp_partition'] = 0;

    let reqDone = Promise.fromCallback(done => {
        this.requests[id] = done;
    });
	return this.ready
		.then(() => {
			let payload = JSON.stringify(request);
			let value = new Buffer(payload);
			this.producer.produce(this.respTopic, null, value);
		})
        .then(function waitKafkaReq() {
            return reqDone
                .timeout(this.timeout, this.listenTopic + ' timeout');
        })
        .finally(() => {
            delete this.requests[id];
        });
}

module.exports = {
	Responder,
	Requester
};
