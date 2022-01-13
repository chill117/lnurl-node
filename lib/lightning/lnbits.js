const _ = require('underscore');
const HttpLightningBackend = require('../HttpLightningBackend');

class LnBitsBackend extends HttpLightningBackend {

	constructor(options) {
		options = options || {};
		super('lnbits', options, {
			defaultOptions: {
				baseUrl: null,
				hostname: 'legend.lnbits.com',
				protocol: 'https',
				requestContentType: 'json',
				adminKey: null,
			},
			requiredOptions: ['adminKey'],
		});
		this.options.headers['X-Api-Key'] = encodeURIComponent(this.options.adminKey);
	}

	checkOptions(options) {
		if (!_.isString(options.adminKey)) {
			throw new Error('Invalid option ("adminKey"): String expected');
		}
		HttpLightningBackend.prototype.checkOptions.call(this, options);
	}

	payInvoice(invoice) {
		return this.request('post', '/api/v1/payments', {
			out: true,
			bolt11: invoice,
		}).then(result => {
			if (!result.payment_hash) {
				throw new Error('Unexpected response from LN Backend [POST /api/v1/payments]: Missing "payment_hash"');
			}
			return { id: null };
		});
	}

	addInvoice(amount, extra) {
		return this.request('post', '/api/v1/payments', {
			out: false,
			amount: Math.floor(amount / 1000),// convert to sats
			memo: extra.description,
		}).then(result => {
			if (!result.payment_request) {
				throw new Error('Unexpected response from LN Backend [POST /api/v1/payments]: Missing "payment_request"');
			}
			return {
				id: null,
				invoice: result.payment_request,
			};
		});
	}

	getInvoiceStatus(paymentHash) {
		const payment_hash = encodeURIComponent(paymentHash);
		return this.request('get', `/api/v1/payments/${payment_hash}`).then(result => {
			if (!result) {
				throw new Error(`Unexpected response from LN Backend [GET /api/v1/payments/${payment_hash}]`);
			}
			const preimage = result.preimage || null;
			const settled = result.paid === true;
			return {
				preimage,
				settled,
			};
		});
	}

	getNodeUri() {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}

	openChannel(remoteId, localAmt, pushAmt, makePrivate) {
		return Promise.reject(new Error('Not supported by this LN service.'));
	}
};

module.exports = LnBitsBackend;
