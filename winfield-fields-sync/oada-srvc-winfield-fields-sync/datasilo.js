import {sign as awsSign} from 'aws-v4-sign-small';
var agent = require('superagent-promise')(require('superagent'), Promise);

// Config of datasilo -- much is fixed / or should be protected
let conf = {
  secretKeyId: 'AKIAIUWOPGZ6F4A6A3MQ',
  secretKey: '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',
  host: 'api.winfielddatasilo.com',
  region: 'us-east-1',
  service: 'execute-api',
  environment: 'qa',
  apiKey: 'pZauSIzZng2hT3bCqivi5aDsUlyTwLbL6s3HjPi1'
};

// Public API

function getGrower() {
  return get('grower', 'application/vnd.datasilo.v1.json', {
    expand: 'farm,field,season'
  });
}

export {getGrower};

//// Helper functions
function get(path, accept, query) {
	var opts = {
		host: conf.host,
		region: conf.region,
		service: conf.service,
		method: 'get',
    path: `/${conf.environment}/${path}`,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
			'Accept': accept,
			'x-api-key': conf.apiKey,
		},
		query
	};


  var req = awsSign(opts, {
		accessKeyId: conf.secretKeyId,
		secretAccessKey: conf.secretKey
	});

  // Not safe to change the host header
  req.headers.host = undefined;

  return agent('GET', `https://${conf.host}${opts.path}`)
		.set(req.headers)
		.end()
    .then(response => response.body);
}
