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
		},
		query
	};
  if (since) opts.headers['if-modified-since'] = since;

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

function del(path) {
	var opts = {
		host: conf.host,
		region: conf.region,
		service: conf.service,
		method: 'delete',
		path: `/${conf.environment}/${path}`,
		headers: {
			'Content-Type': 'application/vnd.datasilo.v1.json',
			'Accept': 'application/json',
			'x-api-key': conf.apiKey,
		},
	};

	const req = aws.sign(opts, {
		accessKeyId: conf.secretKeyId,
		secretAccessKey: conf.secretKey
	});
	return axios({
		method: 'delete',
		url: `https://${conf.host}${opts.path}`,
		headers: req.headers
	})
}

function put(path, data, since) {
  var opts = {
    body: JSON.stringify(data),
		host: conf.host,
		region: conf.region,
    service: conf.service,
		method: 'put',
		path: `/${conf.environment}/${path}`,
		headers: {
			'Content-Type': 'application/vnd.datasilo.v1.json',
			'Accept': 'application/json',
			'x-api-key': conf.apiKey,
		},
	};
  if (since) opts.headers['if-modified-since'] = since;

  console.log('OPTS', opts)
	const req = aws.sign(opts, {
		accessKeyId: conf.secretKeyId,
		secretAccessKey: conf.secretKey
  });
  console.log('DONE SIGNED ~~~~~~~~~~~~~')
	return axios({
    method: 'put',
    data,
		url: `https://${conf.host}${opts.path}`,
		headers: req.headers
  }).catch((err) => {
    console.log('1 - error')
    console.log('1 - error')
    console.log('1 - error')
    console.log('1 - error')
    console.log('1 - ', err.status, error.response.status);
  })
}

function post(path, data, since) {
	var opts = {
    body: JSON.stringify(data),
    host: conf.host,
		region: conf.region,
		service: conf.service,
		method: 'post',
		path: `/${conf.environment}/${path}`,
		headers: {
			'Content-Type': 'application/vnd.datasilo.v1.json',
			'Accept': 'application/vnd.datasilo.v1.json',
			'x-api-key': conf.apiKey,
		},
	};
  if (since) opts.headers['if-modified-since'] = since;
	const req = aws.sign(opts, {
		accessKeyId: conf.secretKeyId,
		secretAccessKey: conf.secretKey
	});
	return axios({
    method: 'post',
    data,
		url: `https://${conf.host}${opts.path}`,
		headers: req.headers
  }).catch((err) => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!')
    console.log('!!!!!!!!!!!!! ', err.status, error.response.status);
	})
}

module.exports = {
  get,
  post,
  delete: del,
  put,
}
