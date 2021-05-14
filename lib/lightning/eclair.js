const _ = require('underscore');
const BigNumber = require('bignumber.js');
const http = require('http');
const https = require('https');
const LightningBackend = require('../LightningBackend');
const querystring = require('querystring');
const url = require('url');

class Backend extends LightningBackend {

	constructor(options) {
		super('eclair', options, {
			defaultOptions: {
				hostname: '127.0.0.1:8080',
				password: '',
				protocol: 'http',
			},
			requiredOptions: ['hostname', 'password', 'protocol'],
		});
	}

	getNodeUri() {
		return this.getNodeInfo().then(info => {
			const { nodeId } = info;
			const hostname = info.publicAddresses[0];
			return `${nodeId}@${hostname}`;
		});
	}

	// https://acinq.github.io/eclair/#getinfo
	getNodeInfo() {
		return this.request('post', '/getinfo').then(result => {
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
	}

	// https://acinq.github.io/eclair/#open
	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return this.request('post', '/open', {
			nodeId: remoteId,
			fundingSatoshis: localAmt,
			pushMsat: (new BigNumber(pushAmt)).times(1000).toNumber(),
			channelFlags: makePrivate ? 0 : 1,
		}).then(result => {
			return result;
		});
	}

	// https://acinq.github.io/eclair/#payinvoice
	payInvoice(invoice) {
		return this.request('post', '/payinvoice', { invoice });
	}

	// https://acinq.github.io/eclair/#createinvoice
	addInvoice(amount, extra) {
		const { description } = extra;
		const data = {
			amountMsat: amount,
			description,
		};
		return this.request('post', '/createinvoice', data).then(result => {
			if (!result.serialized) {
				throw new Error(`Unexpected response from LN Backend [POST /createinvoice]: Missing "serialized"`);
			}
			return result.serialized;
		});
	}

	// https://acinq.github.io/eclair/#getsentinfo
	getInvoiceStatus(paymentHash) {
		return this.request('post', '/getsentinfo', {
			paymentHash,
		}).then(attempts => {
			if (!_.isArray(attempts)) {
				throw new Error(`Unexpected response from LN Backend [POST /getsentinfo]`);
			}
			let preimage = null;
			const settled = _.some(attempts, attempt => {
				if (_.isUndefined(attempt.status)) {
					throw new Error('Unexpected response from LN Backend [POST /getsentinfo]: Missing "status"');
				}
				if (_.isObject(attempt.status) && attempt.status.type === 'sent' && attempt.status.paymentPreimage) {
					preimage = attempt.status.paymentPreimage;
					return true;
				}
			});
			return {
				preimage,
				settled,
			};
		});
	}

	request(method, uri, data) {
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
	}
}

module.exports = Backend;
