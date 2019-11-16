const _ = require('underscore');
const async = require('async');
const fs = require('fs');
const https = require('https');
const url = require('url');

let Lightning = function(options) {
	this.options = options || {};
	this.checkOptions();
};

Lightning.prototype.requiredOptions = ['hostname', 'cert', 'macaroon'];

Lightning.prototype.checkOptions = function() {
	this.checkRequiredOptions();
	const { cert, macaroon } = this.options;
	fs.statSync(cert);
	fs.statSync(macaroon);
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
		return info.uris[0];
	});
};

Lightning.prototype.getNodeInfo = function() {
	return this.request('get', '/v1/getinfo').then((result) => {
		if (_.isUndefined(result.alias) || !_.isString(result.alias)) {
			throw new Error('Unexpected response from LN Backend [GET /v1/getinfo]: "alias"');
		}
		if (_.isUndefined(result.identity_pubkey) || !_.isString(result.identity_pubkey)) {
			throw new Error('Unexpected response from LN Backend [GET /v1/getinfo]: "identity_pubkey"');
		}
		if (_.isUndefined(result.uris) || !_.isArray(result.uris)) {
			throw new Error('Unexpected response from LN Backend [GET /v1/getinfo]: "uris"');
		}
		return result;
	});
};

Lightning.prototype.openChannel = function(remoteid, localAmt, pushAmt, private) {
	return this.request('post', '/v1/channels', {
		node_pubkey_string: remoteid,
		local_funding_amount: localAmt,
		push_sat: pushAmt,
		private: private,
	}).then(result => {
		if (_.isUndefined(result.output_index) || !_.isNumber(result.output_index)) {
			throw new Error('Unexpected response from LN Backend [POST /v1/channels]: "output_index"');
		}
		if (_.isUndefined(result.funding_txid_str) || !_.isString(result.funding_txid_str)) {
			throw new Error('Unexpected response from LN Backend [POST /v1/channels]: "funding_txid_str"');
		}
		return result;
	});
};

Lightning.prototype.payInvoice = function(invoice) {
	return this.request('post', '/v1/channels/transactions', {
		payment_request: invoice,
	}).then(result => {
		if (_.isUndefined(result.payment_preimage) || !_.isString(result.payment_preimage)) {
			throw new Error('Unexpected response from LN Backend [POST /v1/channels/transactions]: "payment_preimage"');
		}
		if (_.isUndefined(result.payment_hash) || !_.isString(result.payment_hash)) {
			throw new Error('Unexpected response from LN Backend [POST /v1/channels/transactions]: "payment_hash"');
		}
		if (_.isUndefined(result.payment_route) || !_.isObject(result.payment_route)) {
			throw new Error('Unexpected response from LN Backend [POST /v1/channels/transactions]: "payment_route"');
		}
		if (result.payment_error) {
			const message = result.payment_error;
			throw new Error(`Failed to pay invoice: "${message}"`);
		}
		if (!result.payment_preimage) {
			throw new Error('Probable failed payment: Did not receive payment_preimage in response');
		}
		return result;
	});
};

Lightning.prototype.getCertAndMacaroon = function() {
	return new Promise((resolve, reject) => {
		const { cert, macaroon } = this.options;
		async.parallel({
			cert: fs.readFile.bind(fs, cert, 'utf8'),
			macaroon: fs.readFile.bind(fs, macaroon, 'hex'),
		}, (error, results) => {
			if (error) return reject(error);
			resolve(results);
		});
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
	return this.getCertAndMacaroon().then(results => {
		const { cert, macaroon } = results;
		let { hostname } = this.options;
		const parsedUrl = url.parse(`https://${hostname}${uri}`);
		let options = {
			method: method.toUpperCase(),
			hostname: parsedUrl.hostname,
			port: parsedUrl.port,
			path: parsedUrl.path,
			headers: {
				'Grpc-Metadata-macaroon': macaroon,
			},
			ca: cert,
		};
		if (!_.isEmpty(data)) {
			data = JSON.stringify(data);
			options.headers['Content-Type'] = 'application/json';
			options.headers['Content-Length'] = Buffer.byteLength(data);
		}
		return new Promise((resolve, reject) => {
			const done = _.once(function(error, result) {
				if (error) return reject(error);
				resolve(result);
			});
			const req = https.request(options, function(res) {
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
	});
};

module.exports = Lightning;
