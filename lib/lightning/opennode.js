const _ = require('underscore');
const BigNumber = require('bignumber.js');
const HttpLightningBackend = require('../HttpLightningBackend');

class OpennodeBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('opennode', options, {
			defaultOptions: {
				apiKey: null,
				baseUrl: null,
				callbackUrl: null,
				// Development => dev-api.opennode.co
				// Production => api.opennode.co
				hostname: 'api.opennode.co',
				protocol: 'https',
				requestContentType: 'json',
			},
			requiredOptions: ['apiKey'],
		});
		this.options.headers['Authorization'] = this.options.apiKey;
	}

	checkOptions(options) {
		if (!_.isString(options.apiKey)) {
			throw new Error('Invalid option ("apiKey"): String expected');
		}
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	// https://developers.opennode.com/reference#initiate-withdrawal
	payInvoice(invoice) {
		let postData = {
			type: 'ln',
			address: invoice,
		};
		if (this.options.callbackUrl) {
			postData.callback_url = this.options.callbackUrl;
		}
		return this.request('post', '/v2/withdrawals', postData).then(result => {
			if (!result.data || !result.data.id) {
				throw new Error('Unexpected response from LN Backend [POST /v2/withdrawals]: Missing "data.id"');
			}
			// Return the identifier instead of the payment hash.
			// We will use this identifier to check payment status later.
			return { id: result.data.id };
		});
	}

	addInvoice(amount, extra) {
		let postData = {
			amount: Math.floor(amount / 1000),// convert to sats
			currency: 'BTC',
			description: extra.description,
		};
		if (this.options.callbackUrl) {
			postData.callback_url = this.options.callbackUrl;
		}
		return this.request('post', '/v1/charges', postData).then(result => {
			if (!result.data || !result.data.id) {
				throw new Error('Unexpected response from LN Backend [POST /v1/charges]: Missing "data.id"');
			}
			if (!result.data || !result.data.lightning_invoice || !result.data.lightning_invoice.payreq) {
				throw new Error('Unexpected response from LN Backend [POST /v1/charges]: Missing "data.lightning_invoice.payreq"');
			}
			return {
				id: result.data.id,
				invoice: result.data.lightning_invoice.payreq,
			};
		});
	}

	getInvoiceStatus(id) {
		const withdrawalId = encodeURIComponent(id);
		return this.request('get', `/v1/withdrawal/${withdrawalId}`).then(result => {
			if (!result.data || !result.data.status) {
				throw new Error('Unexpected response from LN Backend [GET /v1/withdrawal/:id]: Missing "data.status"');
			}
			return {
				preimage: null,
				settled: result.data.status === 'confirmed',
			};
		});
	}

	getNodeUri() {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	validateResponseBody(body) {
		if (body.success === false) {
			throw new Error(body.message);
		}
	}
};

module.exports = OpennodeBackend;
