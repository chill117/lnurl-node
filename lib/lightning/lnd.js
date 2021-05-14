const _ = require('underscore');
const fs = require('fs');
const getTagDataFromPaymentRequest = require('../getTagDataFromPaymentRequest');
const https = require('https');
const LightningBackend = require('../LightningBackend');
const url = require('url');

class Backend extends LightningBackend {

	// lnd's REST API documentation:
	// https://api.lightning.community/#lnd-rest-api-reference

	constructor(options) {
		super('lnd', options, {
			defaultOptions: {
				hostname: '127.0.0.1:8080',
				cert: null,
				macaroon: null,
				protocol: 'https',
			},
			requiredOptions: ['hostname', 'cert', 'macaroon'],
		});
		this.prepareCertAndMacaroon();
	}

	checkOptions(options) {
		if (_.isString(options.cert)) {
			fs.statSync(options.cert);
		} else if (_.isObject(options.cert)) {
			if (!options.cert.data || (!_.isString(options.cert.data) && !Buffer.isBuffer(options.cert.data))) {
				throw new Error('Invalid option ("cert"): Expected { data: Buffer/String }');
			}
		} else {
			throw new Error('Invalid option ("cert"): Object or string expected');
		}
		if (_.isString(options.macaroon)) {
			fs.statSync(options.macaroon);
		} else if (_.isObject(options.macaroon)) {
			if (!options.macaroon.data || (!_.isString(options.macaroon.data) && !Buffer.isBuffer(options.macaroon.data))) {
				throw new Error('Invalid option ("macaroon"): Expected { data: Buffer/String }');
			}
		} else {
			throw new Error('Invalid option ("cert"): Object or string expected');
		}
	}

	prepareCertAndMacaroon() {
		const options = this.options;
		let cert, macaroon;
		if (_.isString(options.cert)) {
			cert = fs.readFileSync(options.cert).toString('utf8');
		} else {
			cert = options.cert.data;
			if (Buffer.isBuffer(cert)) {
				cert = cert.toString('utf8');
			}
		}
		if (_.isString(options.macaroon)) {
			macaroon = fs.readFileSync(options.macaroon).toString('hex');
		} else {
			macaroon = options.macaroon.data;
			if (Buffer.isBuffer(macaroon)) {
				macaroon = macaroon.toString('hex');
			}
		}
		this.cert = cert;
		this.macaroon = macaroon;
	}

	getNodeUri() {
		return this.getNodeInfo().then(info => {
			return info.uris[0];
		});
	}

	// https://api.lightning.community/#v1-getinfo
	getNodeInfo() {
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
	}

	// https://api.lightning.community/#post-v1-channels
	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return this.request('post', '/v1/channels', {
			node_pubkey_string: remoteId,
			local_funding_amount: localAmt,
			push_sat: pushAmt,
			private: makePrivate,
		}).then(result => {
			if (result.funding_txid_bytes) {
				result.funding_txid_str = Buffer.from(result.funding_txid_bytes, 'base64').toString('hex');
			}
			if (_.isUndefined(result.output_index) || !_.isNumber(result.output_index)) {
				throw new Error('Unexpected response from LN Backend [POST /v1/channels]: Missing "output_index"');
			}
			if (_.isUndefined(result.funding_txid_str) && _.isUndefined(result.funding_txid_bytes)) {
				throw new Error('Unexpected response from LN Backend [POST /v1/channels]: Expected "funding_txid_str" or "funding_txid_bytes"');
			}
			return result;
		});
	}

	// https://api.lightning.community/#v1-channels-transactions
	payInvoice(invoice) {
		return this.request('post', '/v1/channels/transactions', {
			payment_request: invoice,
		}).then(result => {
			if (result.error) {
				throw new Error(result.error);
			}
			return result;
		});
	}

	// https://api.lightning.community/#post-v1-invoices
	addInvoice(amount, extra) {
		const { descriptionHash } = extra;
		const descriptionHashBase64 = Buffer.from(descriptionHash, 'hex').toString('base64');
		return this.request('post', '/v1/invoices', {
			value_msat: amount,
			description_hash: descriptionHashBase64,
		}).then(result => {
			if (!result.payment_request) {
				throw new Error('Unexpected response from LN Backend [POST /v1/invoices]: Missing "payment_request"');
			}
			return result.payment_request;
		});
	}

	// https://api.lightning.community/#v1-invoice
	getInvoiceStatus(paymentHash) {
		const r_hash = encodeURIComponent(paymentHash);
		return this.request('get', `/v1/invoice/${r_hash}`).then(result => {
			if (!_.isObject(result)) {
				throw new Error(`Unexpected response from LN Backend [GET /v1/invoice/${r_hash}]`);
			}
			if (_.isUndefined(result.r_preimage)) {
				throw new Error(`Unexpected response from LN Backend [GET /v1/invoice/${r_hash}]: Missing "r_preimage"`);
			}
			if (_.isUndefined(result.settled)) {
				throw new Error(`Unexpected response from LN Backend [GET /v1/invoice/${r_hash}]: Missing "settled"`);
			}
			const preimage = result.r_preimage || null;
			const settled = result.settled === true;
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
		const { cert, macaroon } = this;
		let { hostname, protocol } = this.options;
		const parsedUrl = url.parse(`${protocol}://${hostname}${uri}`);
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
						return done(new Error(`Unexpected response from LN backend: HTTP_${status}_ERROR:\n${body}`));
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
};

module.exports = Backend;
