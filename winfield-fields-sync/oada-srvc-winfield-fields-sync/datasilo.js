const aws = require('aws-v4-sign-small');
const axios = require('axios');
const moment = require('moment');

let conf = require('./secret-config.js').other;

function get(path, query, since) {
	query = query || {};
	var opts = {
		host: conf.host,
		region: conf.region,
		service: conf.service,
		method: 'get',
		path: `/${conf.environment}/${path}`,
		headers: {
			'Content-Type': 'application/vnd.datasilo.v1.json',
			'Accept': 'application/json',
			'x-api-key': conf.apiKey,
			'if-modified-since': since,
		},
		query
	};

	const req = aws.sign(opts, {
		accessKeyId: conf.secretKeyId,
		secretAccessKey: conf.secretKey
	});
	return axios({
		method: 'get',
		url: `https://${conf.host}${opts.path}`,
		headers: req.headers
	})
}
module.exports = {
	get,
}
