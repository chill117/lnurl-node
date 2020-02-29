const _ = require('underscore');
const async = require('async');
const BigNumber = require('bignumber.js');
const fs = require('fs');
const http = require('http');
const https = require('https');
const querystring = require('querystring');
const url = require('url');

let Lightning = function(options) {
	this.options = _.defaults(options || {}, this.defaultOptions);
	this.checkOptions();
};

Lightning.prototype.defaultOptions = {
	hostname: '127.0.0.1:8080',
	password: '',
	protocol: 'http',
};

Lightning.prototype.requiredOptions = ['hostname', 'password', 'protocol'];

Lightning.prototype.checkOptions = function() {
	this.checkRequiredOptions();
};

Lightning.prototype.checkRequiredOptions = function() {
	_.each(this.requiredOptions, name => {
		if (!this.options[name]) {
			throw new Error(`Missing required option: "lightning.config.${name}"`);
		}
	});
};

Lightning.prototype.getNodeUri = function() {
	return this.getNodeInfo().then(info => {
		const { nodeId } = info;
		const hostname = info.publicAddresses[0];
		return `${nodeId}@${hostname}`;
	});
};

Lightning.prototype.getNodeInfo = function() {
	const method = 'POST';
	const uri = '/getinfo';
	return this.request(method, uri).then(result => {
		const expectedAttributes = ['nodeId', 'publicAddresses'];
		_.each(expectedAttributes, key => {
			if (_.isUndefined(result[key])) {
				throw new Error(`Unexpected response from LN Backend [${method} ${uri}]: Missing "${key}"`);
			}
		});
		if (!_.isString(result.nodeId)) {
			throw new Error(`Unexpected response from LN Backend [${method} ${uri}]: Expected "nodeId" to be string`);
		}
		if (!_.isArray(result.publicAddresses)) {
			throw new Error(`Unexpected response from LN Backend [${method} ${uri}]: Expected "publicAddresses" to be array`);
		}
		return result;
	});
};

Lightning.prototype.openChannel = function(remoteid, localAmt, pushAmt, private) {
	const method = 'POST';
	const uri = '/open';
	const data = {
		nodeId: remoteid,
		fundingSatoshis: localAmt,
		pushMsat: (new BigNumber(pushAmt)).times(1000).toNumber(),
		channelFlags: private ? 0 : 1,
	};
	return this.request(method, uri, data).then(result => {
		return result;
	});
};

Lightning.prototype.payInvoice = function(invoice) {
	const method = 'POST';
	const uri = '/payinvoice';
	const data = {
		invoice: invoice,
	};
	return this.request(method, uri, data).then(result => {
		return result;
	});
};

Lightning.prototype.request = function(method, uri, data) {
	if (!_.isString(method)) {
		throw new Error('Invalid argument ("method"): String expected');
	}
	if (!_.isString(uri)) {
		throw new Error('Invalid argument ("uri"): String expected');
	}
	data = data || {};
	if (!_.isObject(data)) {
		throw new Error('Invalid argument ("data"): Object expected');
	}
	const { hostname, password, protocol } = this.options;
	const parsedUrl = url.parse(`${protocol}://${hostname}${uri}`);
	let options = {
		method: method.toUpperCase(),
		hostname: parsedUrl.hostname,
		port: parsedUrl.port,
		path: parsedUrl.path,
		headers: {
			'Authorization': 'Basic ' + Buffer.from('"":' + password, 'utf8').toString('base64'),
		},
	};
	if (!_.isEmpty(data)) {
		data = querystring.stringify(data);
		options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
	}
	return new Promise((resolve, reject) => {
		const done = _.once(function(error, result) {
			if (error) return reject(error);
			resolve(result);
		});
		const request = protocol === 'http' ? http.request : https.request;
		const req = request(options, function(res) {
			let body = '';
			res.on('data', function(buffer) {
				body += buffer.toString();
			});
			res.on('end', function() {
				if (res.statusCode >= 300) {
					const status = res.statusCode;
					return done(new Error(`Unexpected response from LN backend: HTTP_${status}_ERROR`));
				}
				try {
					body = JSON.parse(body);
				} catch (error) {
					return done(new Error('Unexpected response format from LN backend: JSON data expected'));
				}
				done(null, body);
			});
		});
		req.once('error', done);
		if (!_.isEmpty(data)) {
			req.write(data);
		}
		req.end();
	});
};

module.exports = Lightning;
