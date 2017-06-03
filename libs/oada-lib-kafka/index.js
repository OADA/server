'use strict';

const kf = require('node-rdkafka');
const config = require('./config');
const Promise = require('bluebird');

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
		})})
		.then(() => {
			this.consumer.subscribe([listenTopic]);
			this.consumer.consume();
		});
	let producerReady = Promise.fromCallback(done => {
		this.producer.on('ready', () => {
			done();
		})}); 
	this.ready = Promise.join(consumerReady, producerReady);
	this.consumer.connect();
	this.producer.connect();
}

Responder.prototype.on = function on(event, callback) {
	switch(event) {
		case 'request':
			this.consumer.on('data', (data) => {
				let resp = callback(JSON.parse(data.value));
				this.ready.return(resp)
					.then(resp => {
						if (!Array.isArray(resp)) {
							return [resp];
						}
						return resp;
					})
					.map(resp => {
						let payload = JSON.stringify(resp);
						let value = new Buffer(payload);
						this.producer.produce(this.respTopic, -1, value, '', null);
					})
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
		})})
		.then(() => {
			this.consumer.subscribe([listenTopic]);
			this.consumer.consume();
		});
	let producerReady = Promise.fromCallback(done => {
		this.producer.on('ready', () => {
			done();
		})}); 
	this.ready = Promise.join(consumerReady, producerReady);
	this.consumer.connect();
	this.producer.connect();
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

Requester.prototype.send = function send(request, callback) {
	return this.ready.return(request)
		.then(request => {
			console.log('producer is ready');
			if (!Array.isArray(request)) {
				return [request];
			}
			return request;
		})
		.map(request => {
			console.log(request);
			let payload = JSON.stringify(request);
			let value = new Buffer(payload);
			this.producer.produce(this.respTopic, -1, value, '', null);
		})
		.then(callback);
}

module.exports = {
	Responder,
	Requester
};
