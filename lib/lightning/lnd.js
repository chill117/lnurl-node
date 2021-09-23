const _ = require('underscore');
const createHash = require('../createHash');
const fs = require('fs');
const getTagDataFromPaymentRequest= require('../getTagDataFromPaymentRequest');
const HttpLightningBackend = require('../HttpLightningBackend');

class LndBackend extends HttpLightningBackend {

	// lnd's REST API documentation:
	// https://api.lightning.community/#lnd-rest-api-reference

	constructor(options) {
		super('lnd', options, {
			defaultOptions: {
				cert: null,
				hostname: '127.0.0.1:8080',
				macaroon: null,
				protocol: 'https',
				requestContentType: 'json',
			},
			requiredOptions: ['hostname', 'macaroon'],
		});
		this.options.headers['Grpc-Metadata-macaroon'] = this.options.macaroon;
	}

	processOptions(options) {
		let { cert, macaroon } = options;
		if (_.isString(cert)) {
			cert = fs.readFileSync(cert).toString('utf8');
		} else if (_.isObject(cert) && cert.data) {
			cert = cert.data;
			if (Buffer.isBuffer(cert)) {
				cert = cert.toString('utf8');
			}
		}
		if (_.isString(macaroon)) {
			macaroon = fs.readFileSync(macaroon).toString('hex');
		} else if (_.isObject(macaroon) && macaroon.data) {
			macaroon = macaroon.data;
			if (Buffer.isBuffer(macaroon)) {
				macaroon = macaroon.toString('hex');
			}
		}
		options.cert = cert;
		options.macaroon = macaroon;
		return options;
	}

	checkOptions(options) {
		if (options.cert) {
			if (_.isString(options.cert)) {
				fs.statSync(options.cert);
			} else if (_.isObject(options.cert)) {
				if (!options.cert.data || (!_.isString(options.cert.data) && !Buffer.isBuffer(options.cert.data))) {
					throw new Error('Invalid option ("cert"): Expected { data: Buffer/String }');
				}
			} else {
				throw new Error('Invalid option ("cert"): Object or string expected');
			}
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
		options = this.processOptions(options);
		HttpLightningBackend.prototype.checkOptions.call(this, options);
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
			private: makePrivate === 1,
		});
	}

	// https://api.lightning.community/#v1-channels-transactions
	payInvoice(invoice) {
		return this.request('post', '/v1/channels/transactions', { payment_request: invoice }).then(result => {
			if (result.payment_error) {
				throw new Error(result.payment_error);
			}
			if (!result.payment_preimage) {
				throw new Error('Unexpected response from LN Backend [POST /v1/invoices]: Missing "payment_preimage"');
			}
			const paymentHash = getTagDataFromPaymentRequest(invoice, 'payment_hash');
			const preimage = Buffer.from(result.payment_preimage, 'base64').toString('hex');
			if (createHash(preimage) !== paymentHash) {
				throw new Error(`Payment preimage does not match payment hash in invoice: preimage = ${preimage}, invoice = ${invoice}`);
			}
			return { id: null };
		});
	}

	// https://api.lightning.community/#post-v1-invoices
	addInvoice(amount, extra) {
		let data = {
			value_msat: amount,
		};
		if (extra && extra.descriptionHash) {
			data.description_hash = Buffer.from(extra.descriptionHash, 'hex').toString('base64');
		}
		return this.request('post', '/v1/invoices', data).then(result => {
			if (!result.payment_request) {
				throw new Error('Unexpected response from LN Backend [POST /v1/invoices]: Missing "payment_request"');
			}
			return {
				id: null,
				invoice: result.payment_request,
			};
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
			const preimage = (result.r_preimage && Buffer.from(result.r_preimage, 'base64').toString('hex')) || null;
			const settled = result.settled === true;
			return { preimage, settled };
		});
	}

	validateResponseBody(body) {
		if (body.error) {
			throw new Error(body.error);
		}
	}
};

module.exports = LndBackend;
